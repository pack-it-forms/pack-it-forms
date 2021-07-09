/* Copyright 2014 Keith Amidon
   Copyright 2014 Peter Amidon
   Copyright 2018 John Kristian

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License. */

/* Common code for handling PacFORMS forms */

/* --- Commonly used global objects */
var query_object = {};     // Cached query string parameters
var outpost_envelope = {}; // Cached outpost envelop information
var callprefixes = {};     // Cached call prefixes for expansion
var msgfields = {};        // Cached message field values
var versions = {};         // Version information

/* --- Registration for code to run after page loads

Registered startup functions are the initial entry points for
execution after the page loads.  This is implements the mechanism, the
calls registering startup functions are at the end of this file. */
var startup_functions = new Array();

function startup() {
    /* The startup functions are called in continuation-passing style,
    so that they can contain asynchronous code that moves to the next
    function when it is complete. */
    startup_functions.shift()(callclist(startup_functions));

    function callclist(functions) {
        return function() {
            if (functions.length > 0) {
                functions.shift()(callclist(functions));
            }
        };
    }
}

window.onload=startup;

/* --- Initialize the form as required by query parameters */

/* Initialize a form

The form field values will either be set from the form data message
contents found in one of these locations in order of preference:

1. the textContent of the div with ID "form-data"
2. a file at the location "msgs/<fragment-id>", where <fragment-id>
   is the fragment identifier from the URL of the document.

If no form data exists in any of these locations a new form will be
filled with default contents.  The default data filling includes
reading the Outpost query string parameters, which should allow for
good Outpost integration. */
function init_form(next) {
    // Setup focus tracking within the form
    var the_form = document.querySelector("#the-form");
    last_active_form_element = document.activeElement;
    the_form.addEventListener("focus", function (ev) {
        last_active_form_element = ev.target;
    }, true);
    the_form.addEventListener("input", formChanged);

    var text = get_form_data_from_div();
    if (text.trim().length != 0) {
        init_form_from_msg_data(text);
    } else {
        var  msgno = query_object['msgno'];
        if (msgno) {
            var msg_url = "msgs/" + msgno;
            try {
                open_async_request("GET", msg_url, "text", function (text) {
                    if (text.trim().length > 0) {
                        set_form_data_div(text);
                        init_form_from_msg_data(text);
                    }
                }, function () {});
            } catch (e) {
            }
        }
    }
    /* Wait 10ms to force Javascript to yield so that the DOM can be
     * updated before we do other work. */
    window.setTimeout(function () {
        expand_templated_items();
        var first_field = document.querySelector("#the-form :invalid");
        if (first_field) {
            first_field.focus();
        } else {
            the_form[0].focus();
        }
        check_the_form_validity();
        write_pacforms_representation();
        next();
    }, 10);
}

/* Cross-browser resource loading w/local file handling

This function uses an Msxml2.XMLHTTP ActiveXObject on Internet
Explorer and a regular XMLHttpRequest in other places because using
the ActiveXObject in Internet Explorer allows a file loaded through a
file:// uri to access other resources through a file:// uri. */
function open_async_request(method, url, responseType, cb, err) {
    var request;
    if (window.ActiveXObject !== undefined) {
        request = new ActiveXObject("Msxml2.XMLHTTP");
        request.open(method, url, false);
        request.onreadystatechange = function(e) {
            if (request.readyState == 4) {
                var text = request.responseText;
                if (ActiveXObject_responseType_funcs.hasOwnProperty(responseType)) {
                    cb(ActiveXObject_responseType_funcs[responseType](text));
                }
            }
        };
        request.send();
    } else {
        request = new XMLHttpRequest();
        request.open(method, url, true);
        request.responseType = responseType;
        // Opera won't load HTML documents unless the MIME type is
        // set to text/xml
        var overriden = false;
        request.onreadystatechange = function callcb(e) {
            if (e.target.readyState == e.target.DONE) {
                if (e.target.response) {
                    cb(e.target.response);
                } else if (responseType == "document" && !overriden) {
                    request = new XMLHttpRequest();
                    request.open(method, url, true);
                    request.responseType = responseType;
                    request.overrideMimeType("text/xml");
                    overriden = true;
                    request.onreadystatechange = callcb;
                    request.send();
                } else {
                    err();
                }
            }
        };
        request.send();
    }
}

/* Since Msxml2.XMLHTTP doesn't support proper response types, we use
   these functions in Internet Explorer to convert text into the
   correct types.  Currently, only text and document types are
   supported. */
var ActiveXObject_responseType_funcs = {
    "text": function(result) {
        return result;
    },
    "document": function(result) {
        return new DOMParser().parseFromString(result, "text/html");
    }
};


/* --- Read PacFORMS message data and insert in form */

/* Parse form field data from packet message and initialize fields.

This function sets up a form with the contents of an already existing
form data message, which is passed in as text.  It is implemented as a
wrapper around init_form_from_fields. */
function init_form_from_msg_data(text) {
    msgfields = parse_form_data_text(text);
    if (msgfields.MsgNo) {
        var status = query_object.message_status;
        if (status == 'new' || status == 'draft' || status == 'ready' || status == 'sent') {
            // I sent this message.
            query_object.msgno = msgfields.MsgNo; // show My Msg #
        } else {
            // I received this message.
            query_object.txmsgno = msgfields.MsgNo; // show the Sender's Msg #
        }
    }
    init_form_from_fields(msgfields, "name", "msg-value");
}

function parse_form_data_text(text) {
    var fields = {};
    var field_name = null;
    var field_value = "";
    for_each_line(text, function (linenum, line) {
        if (line.charAt(0) == "#") {
            return;  // Ignore "comments"
        }
        if (line.match(/^\s*$/)) {
            return;  // Ignore empty lines
        }
        if (line.match(/^!OUTPOST! /)) {
            // Grab outpost data fields and store for substitution
            outpost_envelope = outpost_envelope_to_object(line);
            return;
        }
        if (line.match(/^!.*!/)) {
            return;  // Ignore line as we don't need anything from it.
        }
        var idx = 0;
        if (field_name == null) {
            idx = index_of_field_name_sep(linenum, line, idx);
            field_name = line.substring(0, idx);
            idx = index_of_field_value_start(linenum, line, idx);
        }
        field_value += line.substring(idx);
        var value = unbracket_data(field_value);
        if (value) {
            // Field is complete on this line
            fields[field_name] = value;
            field_name = null;
            field_value = "";
        }
    });
    return fields;
}

function FormDataParseError(linenum, desc) {
    var msgtext = "Parse error on line " + linenum.toString() + ": " + desc;

    Object.defineProperty(this, 'name', {
        enumerable: false,
        writable: false,
        value: "FormDataParseError"
    });

    Object.defineProperty(this, 'linenum', {
        enumerable: false,
        writable: false,
        value: linenum
    });

    Object.defineProperty(this, 'message', {
        enumerable: false,
        writable: true,
        value: msgtext
    });

    if (Error.hasOwnProperty('captureStackTrace')) {
        Error.captureStackTrace(this, FormDataParseError);
    } else {
        Object.defineProperty(this, 'stack', {
            enumerable: false,
            writable: false,
            value: (new Error(msgtext)).stack
        });
    }
}
FormDataParseError.prototype = Object.create(Error.prototype, {
    constructor: { value: FormDataParseError }
});

function index_of_field_name_sep(linenum, line, startAt) {
    var idx = line.indexOf(":", startAt);
    if (idx == -1) {
        throw new FormDataParseError(linenum, "no field name/value separator on line");
    }
    return idx;
}

function index_of_field_value_start(linenum, line, startAt) {
    var idx = line.indexOf("[", startAt);
    if (idx == -1) {
        throw new FormDataParseError(linenum, "no field value open bracket");
    }
    return idx;
}

/* Initialize form from dictionary of settings

This function sets up a form with the contents of a fields object; it
determines which fields should be initialized by matching the
beginning of attribute againt the name of each field.

If the optional third parameter is supplied it is the name of a class
that should be added to the classList of the elements that are set by
this function.*/
function init_form_from_fields(fields, attribute, className) {
    for (var field in fields) {
        var elem = document.querySelectorAll("["+attribute+"^=\""+field+"\"]");
        /* The above CSS selector does a prefix match which can return
           multiple elements. This is intentionally done to support a
           special case for compatibility with the PacFORMs ICS213
           form which uses a value from either a select element or, if
           that select element has the value "Other", a corresponding
           text input element instead with both using the same field
           name in the PacFORMs representation. This means that the
           value "Other" for a select element triggers additional
           functionality. It is believed that this should not cause
           issues for any existing or planned forms. */
        array_some(elem, function (element) {
            if (element.classList.contains("no-msg-init")) {
                return true;
            }
            if (init_from_msg_funcs.hasOwnProperty(element.type)) {
                if (className) {
                    element.classList.add(className);
                }
                var stop = init_from_msg_funcs[element.type](element, fields[field]);
                fireEvent(element, 'change');
                return stop;
            } else {
                return false;
            }
        });
    }
}

/* Functions to set form fields to values

These functions are used when reading the values from a PacForms-type
text back into the form.  In general, they might be called multiple
times with the same value argument, as some things require setting
multiple elements, like radiobuttons.  A return value of true means
that the caller should stop processing; any other return means that
the caller should continue. */
var init_from_msg_funcs = {
    "text": function(element, value) {
        element.value = value;
        return true;
    },
    "textarea": function(element, value) {
        element.value = unescape_pacforms_string(value);
        return true;
    },
    "radio": function(element, value) {
        if (element.value == value) {
            element.checked = true;
            return true;
        } else {
            element.checked = false;
            return false;
        }
    },
    "select-one": function (element, value) {
        var member = false;
        element.value = "Other";
        array_for_each(element.options, function (option) {
            if (option.value == value) {
                element.value = value;
                member = true;
            }
        });
        /* If it is one of the standard options and has been set, then
        there is no need for further processing.  However, if it is
        not a standard option, that we must continue processing and
        set it as the "other" field's value. */
        return member;
    },
    "checkbox": function (element, value) {
        /* PacForms will only send a checkbox if it is checked */
        element.checked = true;
        return true;
    }
};

var unescape_func = {
    "\\": function () { return "\\"; },
    "n": function () { return "\n"; }
};

/* This cannot be implemented as a string-replace function that
   handles all cases, so it is implemented by iterating through the
   given string and processing all of the escapes.  Each escape
   character is looked up in a dictionary that contains functions that
   return the correct character. */
function unescape_pacforms_string(string) {
    var processing_escape;
    var result = "";
    string.split('').forEach(function (element, index, array) {
        if (processing_escape) {
            if (unescape_func.hasOwnProperty(element)) {
                result += unescape_func[element]();
            }
            processing_escape = false;
        } else if (element == "\\") {
            processing_escape = true;
        } else {
            result += element;
        }
    });
    return result;
}


/* --- Generate PacFORMS message data from form fields */

/* Generate PacForms-compatible representation of the form data

A PacForm-like description of the for mfield values is written into
the textContent of the div with ID "form-data". */
function write_pacforms_representation() {
    var form = document.querySelector("#the-form");
    var fldtxt = "";
    array_for_each(form.elements, function(element, index, array) {
        var result;
        if (element.disabled) {
            result = null;
        } else if (pacform_representation_funcs.hasOwnProperty(element.type)) {
            result = pacform_representation_funcs[element.type](element);
            if (element.classList.contains("init-on-submit")) {
                result = expand_template(result);
            }
            result = bracket_data(result);
        } else {
            result = null;
        }
        if (result) {
            var numberMatch = /((?:[0-9]+[a-z]?\.)+).*/.exec(element.name);
            var resultText;
            if (numberMatch) {
                resultText = numberMatch[1]+": "+result;
            } else {
                resultText = element.name+": "+result;
            }
            fldtxt += "\r\n"+resultText;
        }
    });
    var msg = expand_template(
        document.querySelector("#message-header").textContent).trim();
    msg += fldtxt + "\r\n#EOF\r\n";
    set_form_data_div(msg);
}

var pacform_representation_funcs = {
    "text": function(element) {
        return element.value ? element.value : null;
    },
    "textarea": function(element) {
        return element.value ? escape_pacforms_string(element.value) : null;
    },
    "radio": function(element) {
        return element.checked ? element.value : null;
    },
    "select-one": function(element) {
        return element.value != "Other" ? element.value : null;
    },
    "checkbox": function(element) {
        return element.checked ? "checked" : null;
    }
};

function escape_pacforms_string(string) {
    return string.replace(/\\/g, "\\\\").replace(/\n/g,"\\n");
}

function bracket_data(data) {
    if (data) {
        data = data.replace(/`]/g, "``]");
        data = data.replace(/([^`])]/g, "$1`]");
        return "[" + data + "]";
    } else {
        return null;
    }
}

function unbracket_data(data) {
    var match = /[^`]]\s*$/.exec(data);
    if (match) {
        // data is complete
        data = data.substring(1, data.length - match[0].length + 1);
        return data.replace(/`]/g, "]");
    } else {
        return null;
    }
}

function selected_field_values(css_selector) {
    var result = [];
    var elem = document.querySelectorAll(css_selector);
    array_for_each(elem, function (element) {
        if (pacform_representation_funcs.hasOwnProperty(element.type)) {
            var rep = pacform_representation_funcs[element.type](element);
            result.push(emptystr_if_null(rep));
        }
    });
    return result;
}

function field_value(field_name) {
    return selected_field_values("[name=\""+field_name+"\"]").join("");
}


/* --- Template expansion */

/* Expand template string by replacing placeholders

Plain text included in the template is copied to the expanded output.
Placeholders are enclosed in square brackets.  There are six possible
forms of the placeholders:

   1. {{<type_name>}}
   2. {{<type_name>|<filter_name>}}
   3. {{<type_name>|<filter_name>:<filter_arg>}}
   4. {{<type_name>:<type_arg>}}
   5. {{<type_name>:<type_arg>|<filter_name>}}
   6. {{<type_name>:<type_arg>|<filter_name>:<filter_arg>}}

In form #1, the placeholder function named by <type_name> is called
and the result it returns is substituted.  There is a type_name if "{"
to allow inserting consecutive open braces is required.

In form #2, the placeholder function named by <type_name> is called
and the result it returns is passed to the filter function named by
<filter_name>.  The result returned from the filter function is
substituted.

Form #3 is like form #2 except the <filter_arg> text is passed to the
filter function as well.  The interpretation of the <filter_arg> text
is determined by the filter function and the argument may be complete
ignored.

Form #4 is like form #1 except the <type_arg> text passed to the
placeholder function as well.  The interpretation of the <type_arg>
text is determined by the placeholder function and the arguement may
be complete ignored.

Form #5 is the combination of #2 and #4.

Form #6 is the combination of #3 and #5.

Additionally, multiple filters can be chained one after another in the
manner of unix pipelines.  Each filter may take an optional argument,
which may be ignored. */
function expand_template(tmpl_str) {
    var final_str = "";
    var tokens = tokenize_template(tmpl_str);
    tokens.forEach(function (t) {
        if (t[0] == "literal") {
            final_str += t[1];
        } else if (t[0] == "template") {
            var stages = split_with_escape_tokenized(t[1], "|");
            var a = stages.shift().split(":");
            var fname = a.shift();
            var farg = a.join(":");
            var value = template_repl_func[fname](farg);
            stages.forEach(function (f) {
                var a = f.split(":");
                var fname = a.shift();
                var farg = a.join(":");
                if (template_filter_func.hasOwnProperty(fname)) {
                    value = template_filter_func[fname](farg, value);
                } else {
                    throw new TemplateException("Unknown filter function");
                }
            });
            final_str += value;
        } else {
            throw new TemplateException("Unknown template token type");
        }
    });
    return final_str;
}

function tokenize_template(tmpl_str) {
    var result = [];
    var stack = [];
    var frag = tmpl_str.split("{{");
    frag = frag.map(function (e) { return e.split("}}"); });
    result.push([ "literal", frag[0].join("}}")]);
    for (var i = 1; i < frag.length; i++) {
        stack.push(frag[i][0]);
        for (var j = 1; j < frag[i].length; j++) {
            // Closing previously opened
            if (stack.length > 1) {
                var top = stack.pop();
                var next = stack.pop();
                stack.push(next + "{{" + top + "}}" + frag[i][j]);
            } else if (stack.length == 1) {
                result.push(["template", stack.pop()]);
                result.push(["literal", frag[i][j]]);
            } else {
                result.push(["literal", "}}" + frag[i][j]]);
            }
        }
    }
    return result;
}

function split_with_escape(str, sep, limit) {
    var cnt = 0;
    var a = Array();
    str.split(sep).forEach(function (c) {
        if (a.length == 0) {
            a.push(c);
        } else {
            var v = a.pop();
            if (limit > 0 && cnt >= limit) {
                a.push(v + sep + c);
            } else if (string_ends_with(v, "\\\\")) {
                a.push(v.substring(0, v.length-1));
                a.push(c);
                cnt++;
            } else if (string_ends_with(v, "\\")) {
                a.push(v.substring(0, v.length-1) + sep + c);
            } else {
                a.push(v);
                a.push(c);
                cnt++;
            }
        }
    });
    return a;
}

function split_with_escape_tokenized(str, sep) {
    var result = [];
    var tokens = tokenize_template(str);
    tokens.forEach(function (t) {
        var v = "";
        if (result.length > 0) {
            v = result.pop();
        }
        if (t[0] == "literal") {
            var elements = split_with_escape(t[1], sep, 0);
            result.push(v + elements.shift());
            elements.forEach(function (e) {
                result.push(e);
            });
        } else if (t[0] == "template") {
            result.push(v + "{{" + t[1] + "}}");
        } else {
            throw new TemplateException("Unknown template token type");
        }
    });
    return result;
}


var template_repl_func = {
    "open-brace" : function (arg) {
        return "{";
    },

    "close-brace" : function (arg) {
        return "}";
    },

    "open-tmpl" : function (arg) {
        return "{{";
    },

    "close-tmpl" : function (arg) {
        return "}}";
    },

    "date" : function (arg) {
        var now = new Date();
        return (padded_int_str(now.getMonth()+1, 2) + "/"
                + padded_int_str(now.getDate(), 2) + "/"
                + padded_int_str(now.getFullYear(), 4));
    },

    "time" : function (arg) {
        var now = new Date();
        return (padded_int_str(now.getHours(), 2) + ":"
                + padded_int_str(now.getMinutes(), 2) + ":"
                + padded_int_str(now.getSeconds(), 2));
    },

    "msgno" : function (arg) {
        return emptystr_if_null(query_object['msgno']);
    },

    "field" : field_value,

    "selected-fields" : selected_field_values,

    "msg-field" : function(arg) {
        return emptystr_if_null(msgfields[arg]);
    },

    "query-string" : function(arg) {
        return emptystr_if_null(query_object[arg]);
    },

    "envelope" : function(arg) {
        return emptystr_if_null(outpost_envelope[arg]);
    },

    "div-id" : function(arg) {
        return document.querySelector("#"+arg).textContent;
    },

    "filename" : function (arg) {
        var i = document.location.pathname.lastIndexOf("/")+1;
        return document.location.pathname.substring(i);
    },

    "version": function(arg) {
        var includes = versions.includes.map(function(i) {
            return i.name + "=" + i.version;
        }).join(", ");
        return versions.form + "; " + includes;
    },

    "title" : function (arg) {
        return document.title;
    },

    "expand-while-null" : function (arg) {
        var templates = split_with_escape_tokenized(arg, ",");
        var value = expand_template(templates.shift());
        while (templates.length  > 0 && value.length == 0) {
            value = expand_template(templates.shift());
        }
        return value;
    }
};

var template_filter_func = {
    "truncate" : function (arg, orig_value) {
        return orig_value.substr(0, arg);
    },

    "split" : function (arg, orig_value) {
        return orig_value.split(arg);
    },

    "join" : function (arg, orig_value) {
        return orig_value.join(arg);
    },

    "remove" : function (arg, orig_value) {
        var result = [];
        orig_value.forEach(function(elem, index, array) {
            if (elem != arg) {
                result.push(elem);
            }
        });
        return result;
    },

    "sort" : function (arg, orig_value) {
        if (arg == "num") {
            return orig_value.sort(function (a,b) { return a-b; });
        } else {
            return orig_value.sort();
        }
    },

    "re_search" : function (arg, orig_value) {
        var re = new RegExp(arg);
        var match = re.exec(orig_value);
        if (match.length == 1) {
            return match[0];
        } else {
            return match;
        }
    },

    "nth" : function (arg, orig_value) {
        last = orig_value.length - 1
        if (last < 0) {
            return undefined;
        }
        if (arg > last) {
            arg = last
        }
        return orig_value[arg];
    },

    "trim" : function (arg, orig_value) {
        return orig_value.trim();
    },

    "msgno2name" : function(arg, orig_value) {
        var name = callprefixes[orig_value.split('-')[0]];
        return name ? name : "";
    },

    "expandtmpl" : function(arg, orig_value) {
        return expand_template(orig_value);
    }
};

function TemplateException(desc) {
    this.name = "TemplateException";
    this.message = desc;
}

/* Initialize text fields to default values through template expansion

The selection of text fields to use is determined by the "selector"
argument, which is a selector suitable to be passed to
document.querySelectorAll.  This does not have to be used on input
elements; attribute determines what attribute will be read and
expanded. */
function init_text_fields(selector, attribute) {
    var fields = document.querySelectorAll(selector);
    array_for_each(fields, function (field) {
        field[attribute] = expand_template(field[attribute]);
    });
}


/* --- Document fragment inclusion */

/* Insert HTML include content in document

This function process all of the HTML elements with an attribute named
"data-include-html".  Each of these elements is replaced with the
contents of outermost div in the the file:

     resources/html/<attribute value>.html

If the replaced element contained body text that is a valid JSON
object any fields in the included HTML that match the property names
in the JSON objects will have their default values set to the
corresponding property value. */
function process_html_includes(next) {
    /* This has to find and do a node, then find the next one, then do
    it, etc. because if two nodes are under one parent then inserting
    the replacement for the first node invalidates the second node. */
    var include = document.querySelector("[data-include-html]");
    if (include) {
        var name = include.getAttribute("data-include-html");
        var msg_url = "resources/html/"+name+".html";
        var msg_request = new XMLHttpRequest();
        open_async_request("GET", msg_url, "document", function (response) {
            // Save the version of the included file
            var version = response.querySelector(".version").textContent;
            versions.includes.unshift({ name: name, version: version });

            var parent = include.parentNode;
            // We have to modify the innerHTML after appending for
            // Firefox to recognize the new elements.
            var child_index = Array.prototype.indexOf.call(parent.children, include);
            // For some reason, getElementById/querySelector do
            // not work in Firefox; the HTML spec says that this
            // should work, because the elements are collected
            // through a pre-order traversal.
            var to_add = response.getElementsByTagName("div")[0].children;
            // Since there can be multiple elements, this iterates
            // through them and forces their display
            while(to_add.length > 0) {
                parent.insertBefore(to_add[0], include);
                parent.children[child_index++].innerHTML += "";
            }
            // Before invalidating the parent element, save the
            // contents (which is the JSON object containing defaults
            // for the fields in that block) to a variable for usage
            // later.
            var defaults = include.textContent;
            // For styles to be applied correctly in Firefox the
            // parent element has to be force-redisplayed as well.
            parent.innerHTML += "";
            // Remove the dummy element
            parent.removeChild(parent.children[child_index]);
            // The continuation passed to the next instance of
            // processing includes a statement that initializes the
            // form with the contents of a JSON object that was inside
            // the <div> including the content.  This means that all
            // of the objects that need to be initialized are
            // accumulated and initialized at the end.
            process_html_includes(function() {
                if (defaults) {
                    init_form_from_fields(JSON.parse(defaults), 'name');
                }
                next();
            });
        }, function () {
            include.parentNode.removeChild(include);
            process_html_includes(next);
        });
    } else {
        // Sort the version information to ensure a stable ordering
        versions.includes.sort(function(a, b) {
            if (a.name < b.name) { return -1; }
            else if (b.name < a.name) { return 1; }
            else { return 0; }
        });
        // If all includes have been processed, then continue;
        next();
    }
}


/* --- Configuration data loading */

/* Load the msgno prefix JSON file into a global variable

This is run at startup, and loads the msgno prefix expansion JSON into
a variable which can then by used by the msgno2name template filter to
determine the location that a msgno prefix originates from. */
function load_callprefix(next) {
    try {
        open_async_request("GET", "cfgs/msgno-prefixes.json", "text", function (data) {
            if (data) {
                callprefixes = JSON.parse(data);
            } else {
                callprefixes = {};
            }
            next();
        }, function () { callprefixes = {}; next(); });
    } catch (e) {
        callprefixes = {};
        next();
    }
}


/* --- Form related utility functions */

/* Clear the form to original contents */
function clear_form() {
    document.querySelector("#the-form").reset();
    set_form_data_div("");
}

/* Check whether the form is valid */
function check_the_form_validity() {
    var button_header = document.querySelector("#button-header");
    var submit_button = document.querySelector("#opdirect-submit");
    var email_button  = document.querySelector("#email-submit");
    var valid = document.querySelector("#the-form").checkValidity();
    if (valid) {
        button_header.classList.add("valid");
        submit_button.disabled = false;
        email_button.disabled = false;
    } else {
        button_header.classList.remove("valid");
        submit_button.disabled = true;
        email_button.disabled = true;
    }
    return valid;
}

/* Callback invoked when the form changes */
function formChanged(event) {
    write_pacforms_representation();
    check_the_form_validity();
}

/* Function invoked when form is submitted */
function opdirect_submit(e) {
    write_pacforms_representation();
    hide_form_data();
    e.preventDefault();
    if (check_the_form_validity()) {
        document.querySelector("#form-data-form").submit();
    }
    return false;
}

/* Function invoked when form is sent over email */
function email_submit(e) {
    write_pacforms_representation();
    hide_form_data();
    e.preventDefault();
    if (check_the_form_validity()) {
        var pacforms_rep = document.querySelector("#form-data").value;
        // Use the subject line of the generated form, like outpost does
        var subject = pacforms_rep.slice(6).split('\n',1)[0];
        document.location = "mailto:?to="
                          + "&Content-Type=application/pack-it-forms"
                          + "&Subject=" + encodeURIComponent(subject)
                          + "&body=" + encodeURIComponent(pacforms_rep);
    }
    return false;
}

/* Function invoked to clear the form */
function clear_form(e) {
    document.location.reload();
}

/* Enable or disable a different control based on onChange values

This is a callback function to be used in the onChange handler of a
select. It enables the form element with name 'target_name' when the
value of the element on which it is add is in the list
'enabledValues'. When the value is not in that list, then target
element is disabled and the targets balue is set to
'target_disabled_value'. */
function value_based_enabler(e, enabledValues, target_name, target_disabled_value) {
    var target = document.querySelector("[name=\""+target_name+"\"]");
    if (array_contains(enabledValues, e.value)) {
        target.disabled = false;
    } else {
        target.value = target_disabled_value;
        target.disabled = true;
    }
    fireEvent(target, 'input');
    check_the_form_validity();
}

/* Disable "other" controls when not in use

This is a callback function to be used in the onChange handler of a
combobox; it will enable the relevant -other field if and only if the
combobox is set to "Other". */
function combobox_other_manager(e) {
    value_based_enabler(e, ["Other"], e.name + "-other", "");
}

/* Handle form data message visibility */
var last_active_form_element;

function show_form_data() {
    var data_div = document.querySelector("#form-data");
    data_div.style.display = "block";
    data_div.tabIndex = "-1";
    data_div.focus();
    document.querySelector("#show-hide-data").value = "Hide Data Message";
    document.querySelector("#form-data").readOnly = true;
}

function hide_form_data() {
    document.querySelector("#form-data").style.display = "none";
    document.querySelector("#show-hide-data").value = "Show Data Message";
    document.querySelector("#form-data").readOnly = false;
    last_active_form_element.focus();
}

function toggle_form_data_visibility() {
    var data_div = document.querySelector("#form-data");
    if (data_div.style.display == "none"
        || data_div.style.display == "") {
        show_form_data();
    } else {
        hide_form_data();
    }
}

function setup_input_elem_from_class(next) {
    if (query_object.mode != "readonly") {
        var setup = {
            "date": {pattern: "(0[1-9]|1[012])/(0[1-9]|1[0-9]|2[0-9]|3[01])/[1-2][0-9][0-9][0-9]",
                     placeholder: "mm/dd/yyyy"},
            "time": {pattern: "([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?",
                     placeholder: "hh:mm"},
            "phone-number": {pattern: "([0-9]{3})?[ -]?[0-9]{3}[ -]?[0-9]{4}",
                             placeholder: "000-000-0000"},
            "cardinal-number": {pattern: "[0-9]*"},
            "real-number": {pattern: "[-+]?[0-9]+(\.[0-9]+)?"}
        };
        array_for_each(document.querySelector("#the-form").elements, function (el) {
            for (var s in setup) {
                if (el.classList.contains(s)) {
                    if (!el.pattern && setup[s].pattern != undefined) {
                        el.pattern = setup[s].pattern;
                    }
                    if (!el.placeholder && setup[s].placeholder != undefined) {
                        el.placeholder = setup[s].placeholder;
                    }
                }
            }
        });
    }
    next();
}

/* Handle the readonly view mode

This is indicated by a mode=readonly query parameter. */
function setup_view_mode(next) {
    if (query_object.mode && query_object.mode == "readonly") {
        document.querySelector("#button-header").classList.add("readonly");
        document.querySelector("#opdirect-submit").hidden = "true";
        document.querySelector("#email-submit").hidden = "true";
        document.querySelector("#show-hide-data").hidden = "true";
        document.querySelector("#clear-form").hidden = "true";
        /* In view mode, we don't want to show the input control chrome.  This
           is difficult to do with textareas which might need scrollbars, etc.
           so insert a div with the same contents and use CSS to appropriately
           style it and hide the textarea. */
        var textareas_to_redisplay = [];
        array_for_each(document.querySelector("#the-form").elements, function (el) {
            if (el.placeholder) {
                el.placeholder = '';
            }
            if (el.type == "radio"
                || el.type == "checkbox"
                || (el.type && el.type.substr(0, 6) == "select")) {
                el.disabled = "true";
            } else {
                el.readOnly = "true";
                if (el.type && el.type.substr(0, 8) == "textarea") {
                    textareas_to_redisplay.push(el);
                }
            }
        });
        for (var i = 0; i < textareas_to_redisplay.length; i++) {
            var el = textareas_to_redisplay[i];
            var textNode = create_text_div(el.value,"view-mode-textarea");
            el.parentNode.insertBefore(textNode, el);
        }
    }
    next();
}


/* --- Misc. utility functions */

function expand_templated_items() {
    init_text_fields(".templated", "textContent");
    init_text_fields("input:not(.no-load-init):not(.msg-value)", "value");
}

function get_form_data_from_div() {
    return document.querySelector("#form-data").value;
}

function set_form_data_div(text) {
    var form_data = document.querySelector("#form-data");
    form_data.value = text;
}

/* Test whether the end of one string matches another */
function string_ends_with(str, val) {
    var end = str.substring(str.length - val.length);
    return end == val;
}

/* Simple padded number output string */
function padded_int_str(num, cnt) {
    var s = Math.floor(num).toString();
    var pad = cnt - s.length;
    for (var i = 0; i < pad; i++) {
        s = "0" + s;
    }
    return s;
}

/* Create a DIV element containing the provided text */
function create_text_div(text, className) {
    var elem = document.createElement("div");
    elem.classList.add(className);
    var textelem = document.createTextNode(text);
    elem.appendChild(textelem);
    return elem;
}

/* Make forEach() & friends easier to use on Array-like objects

This is handy for iterating over NodeSets, etc. from the DOM which
don't provide a forEach method.  In theory we could inject the forEach
method into those object's prototypes but that can on occasion cause
problems. */
function array_for_each(array, func) {
    return Array.prototype.forEach.call(array, func);
}

/* Not very efficent, but handy if the array is known to be small */
function array_contains(array, value) {
    var found = false;
    array_for_each(array, function (v, i, a) {
        if (v == value) {
            found = true;
        }
    });
    return found;
}

function array_some(array, funct) {
    return Array.prototype.some.call(array, funct);
}

/* Execute a statement on each line of a string

The supplied function will be called with two arguments, the line
number of the line being processed and a string with the text of the
line. */
function for_each_line(str, func) {
    var linenum = 1;
    var last_idx = 0;
    var idx = str.indexOf("\n", last_idx);
    while (idx >= 0) {
        func(linenum++, str.substring(last_idx, idx));
        last_idx = idx + 1;
        idx = str.indexOf("\n", last_idx);
    }
    if (last_idx < str.length) {
        func(linenum, str.substring(last_idx));
    }
}

function emptystr_if_null(argument) {
    return argument ? argument : "";
}

/* --- Cross-browser convenience functions --- */

function fireEvent(target, evt) {
    var event = document.createEvent('Event');
    event.initEvent(evt, true, true);
    if (target.disabled && evt == 'input') {
        // work around firefox not firing input events on disabled events
        target.parentElement.dispatchEvent(event);
    } else {
        target.dispatchEvent(event);
    }
}


function outpost_envelope_to_object(line) {
    var data = {};
    line = line.substring(10); // Get rid of "!OUTPOST! "
    var list = line ? line.split(", ") : [];
    list.forEach(function(element, index, array) {
        list = element.split("=");
        data[list[0]] = list.slice(1).join("=");
    });
    return data;
}

/* Generate an object from the query string.

This should be called as an init function; it will store the result in
the global variable query_object */
function query_string_to_object(next) {
    var query = {};
    var string = window.location.search.substring(1);
    var list = string ? string.split("&") : [];
    list.forEach(function(element, index, array) {
        list = element.split("=");
        query[list[0]] = decodeURIComponent(list[1].replace("+", "%20"));
    });
    query_object = query;
    next();
}

function load_form_version(next) {
    versions.form = document.querySelector(".version").textContent;
    versions.includes = [];
    next();
}

function remove_loading_overlay(next) {
    var el = document.querySelector("#loading");
    if (el) {
        el.classList.add("done");
    }
    next();
}

function loadingComplete() {
    var el = document.querySelector("#loading");
    return el.classList.contains("done");
}

function showErrorLog() {
    var el = document.querySelector("#err");
    el.classList.add("occured");
}

function hideErrorLog() {
    var el = document.querySelector("#err");
    el.classList.remove("occured");
}

function toggleErrorLog() {
    var el = document.querySelector("#err");
    if (el.classList.contains("occured")) {
        el.classList.remove("occured");
    } else {
        el.classList.add("occured");
    }
}

function showErrorIndicator() {
    var el = document.querySelector("#error-indicator");
    el.classList.add("occured");
}

function hideErrorIndicator() {
    var el = document.querySelector("#error-indicator");
    el.classList.remove("occured");
}

function setup_error_indicator(next) {
    var el = document.querySelector("#error-indicator");
    el.onclick = toggleErrorLog;
    next();
}

function indicateError() {
    if (loadingComplete()) {
        showErrorIndicator();
    } else {
        showErrorLog();
    }
}

function logError(msg) {
    var el = document.querySelector("#error-log");
    el.textContent = el.textContent + msg + "\n";
    indicateError();
}

window.addEventListener('error', function(event) {
    //if (event.hasAnyProperty('error') && event.error.hasOwnProperty('stack')) {
    logError(event.message
             + " ("
             + (event.url ? event.url : "")
             + (event.lineno ? ":" + event.lineno : "")
             + (event.colno ? ":" + event.colno : "")
             + ")");
    if ("error" in event && event.error &&  "stack" in event.error) {
        logError(event.error.stack)
    }
    return false;
});

/* This is for testing error logging during startup */
function test_error(next) {
    throw new FormDataParseError(10, "This is a test error.");
    next();
}

/* This is for testing the loading overlay */
function startup_delay(next) {
    window.setTimeout(function () {
        next();
    }, 10000);
}


/* --- Registration of startup functions that run on page load */

startup_functions.push(load_form_version);
startup_functions.push(process_html_includes);
startup_functions.push(query_string_to_object);
startup_functions.push(load_callprefix);
startup_functions.push(init_form);
startup_functions.push(setup_input_elem_from_class);
// This must come after query_string_to_object in the startup functions
startup_functions.push(setup_view_mode);
// These must be the last startup functions added
//startup_functions.push(startup_delay);  // Uncomment to test loading overlay
//startup_functions.push(test_error);  // Uncomment to test startup err report
startup_functions.push(setup_error_indicator);
startup_functions.push(remove_loading_overlay);
