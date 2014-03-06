/* Common code for handling PacFORMS forms */

/* Cached query string parameters */
var query_object;

/* Registry for functions to execute when the form is loaded. */
var startup_functions = new Array();

function startup() {
    /* The startup functions are called in continuation-passing style,
    so that they can contain asynchronous code that moves to the next
    function when it is complete. */
    startup_functions.shift()(callclist(startup_functions));

    function callclist(functions) {
        return function() {
            if (functions.length > 0) {
                functions.shift()(callclist(functions))
            }
        }
    }
}

window.onload=startup;

/* Simple padded number output string */
function padded_int_str(num, cnt) {
    var s = Math.floor(num).toString();
    var pad = cnt - s.length
    for (var i = 0; i < pad; i++) {
        s = "0" + s;
    }
    return s;
}

/* Make forEach() easier to use on Array-like objects

This is handy for iterating over NodeSets, etc. from the DOM which
don't provide a forEach method.  In theory we could inject the forEach
method into those object's prototypes but that can on occasion cause
problems. */
function array_for_each(array, func) {
    return Array.prototype.forEach.call(array, func);
}

/* Execute a statement on each line of a string

The supplied function will be called with two arguments, the line
number of the line being processed and a string with the text of the
line. */
function for_each_line(str, func) {
    var linenum = 1;
    var last_idx = 0
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

function field_value(field_name) {
    var result = ""
    var elem = document.querySelectorAll("[name=\""+field_name+"\"]");
    array_for_each(elem, function (element) {
        if (pacform_representation_funcs.hasOwnProperty(element.type)) {
            var rep = pacform_representation_funcs[element.type](element);
            result += stringify_possible_null(rep);
        }
    });
    return result;
}

var template_repl_func = {
    "[" : function (arg) {
        return "[";
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
        return stringify_possible_null(query_object['msgno']);
    },

    "field" : field_value,

    "query-string" : function(arg) {
        return stringify_possible_null(query_object[arg]);
    }
};

var template_filter_func = {
    "truncate" : function (arg, orig_value) {
        return orig_value.substr(0, arg);
    },

    "split" : function (arg, orig_value) {
        return orig_value.split(arg);
    },

    "re_search" : function (arg, orig_value) {
        re = new RegExp(arg);
        match = re.exec(orig_value);
        if (match.length == 1) {
            return match[0];
        } else {
            return match;
        }
    },

    "nth" : function (arg, orig_value) {
        return orig_value[arg];
    }
};

/* Expand template string by replacing placeholders

Plain text included in the template is copied to the expanded output.
Placeholders are enclosed in square brackets.  There are six possible
forms of the placeholders:

   1. [<type_name>]
   2. [<type_name>|<filter_name>]
   3. [<type_name>|<filter_name>:<filter_arg>]
   4. [<type_name>:<type_arg>]
   5. [<type_name>:<type_arg>|<filter_name>]
   6. [<type_name>:<type_arg>|<filter_name>:<filter_arg>]

In form #1, the placeholder function named by <type_name> is called
and the result it returns is substituted.  There is a type_name if "["
to allow inserting an right square bracket.

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
    var final_str = ""
    var repl_re = /\[([^:|\]]+)(?::([^|\]]+))?(?:\|([^\]]+))?]/
    var match = repl_re.exec(tmpl_str);
    while (match) {
        final_str += tmpl_str.substring(0, match.index);
        if (template_repl_func.hasOwnProperty(match[1])) {
            var value = template_repl_func[match[1]](match[2]);
            if (match[3]) {
                split_with_escape(match[3], "|").forEach(function (f) {
                    var a = f.split(":",2);
                    if (template_filter_func.hasOwnProperty(a[0])) {
                        value = template_filter_func[a[0]](a[1], value);
                    } else {
                        throw new TemplateException("Unknown filter function");
                    }
                });
            }
        } else {
            throw new TemplateException("Unknown replacement function");
        }
        final_str += value;
        tmpl_str = tmpl_str.substr(match.index + match[0].length);
        match = repl_re.exec(tmpl_str);
    }
    final_str += tmpl_str;
    return final_str;
}

function split_with_escape(str, sep) {
    var a = Array();
    str.split(sep).forEach(function (c) {
        if (a.length == 0) {
            a.push(c);
        } else {
            var v = a.pop();
            if (v.endsWith("\\\\")) {
                a.push(v.substring(0, v.length-1));
                a.push(c);
            } else if (v.endsWith("\\")) {
                a.push(v + c);
            } else {
                a.push(v);
                a.push(c);
            }
        }
    });
    return a;
}

function TemplateException(desc) {
    this.name = "TemplateException";
    this.message = desc;
}

/* This function initializes a set of text fields to their default
   values.  The selection of text fields to use is determined by the
   "selector" argument, which is a selector suitable to be passed to
   document.querySelectorAll. */
function init_text_fields(selector) {
    var fields = document.querySelectorAll(selector);
    array_for_each(fields, function (field) {
        field.value = expand_template(field.value);
    });
}

/* This function process all of the HTML elements with
   "data-include-html" attributes to include the html files that they
   are pointing at. */
function process_html_includes(next) {
    var includes = document.querySelectorAll("[data-include-html]");
    /* Each time that a request finishes, it increments
    numberComplete; when numberComplete == number it calls the
    continuation to go to the next function. */
    var number = includes.length;
    var numberComplete = 0;
    array_for_each(includes, function (element, index, array) {
        var msg_url = "resources/html/"+element.dataset.includeHtml+".html";
        var msg_request = new XMLHttpRequest();
        msg_request.open("GET", msg_url, true)
        msg_request.responseType = "document";
        msg_request.onreadystatechange = function (e) {
            if (msg_request.readyState == msg_request.DONE) {
                // We have to modify the innerHTML after appending for
                // Firefox to recognize the new elements.
                var parent = element.parentNode;
                var index = Array.prototype.indexOf.call(parent.children, element);
                parent.replaceChild(msg_request.response.documentElement,
                                    element);
                parent.children[index].innerHTML += "";
                numberComplete += 1;
                if (numberComplete == number) {
                    next();
                }
            }
        };
        msg_request.send();
    });
}

startup_functions.push(process_html_includes);

/* Initialize an empty form

This function sets up a new empty form. */
function init_empty_form() {
    init_text_fields("input.init-default");
}

function get_form_data_from_div() {
    return document.querySelector("#form-data").value;
}

function set_form_data_div(text) {
    document.querySelector("#form-data").value = text;
}

var pacform_representation_funcs = {
    "text": function(element) {
        return element.value ? element.value : null;
    },
    "textarea": function(element) {
        return element.value ? "\\n"+element.value : null;
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
}

function bracket_data(data) {
    if (data) {
        data = data.trim();
        data = data.replace("`]", "``]");
        data = data.replace(/([^`])]/, "$1`]");
        return "[" + data + "]";
    } else {
        return null
    }
}

/* Generate PacForms-compatible representation of the form data

A PacForm-like description of the for mfield values is written into
the textContent of the div with ID "form-data". */

function write_pacforms_representation() {
    var form = document.querySelector("#the-form");
    var msg = expand_template(
        document.querySelector("#message-header").textContent).trim()
    init_text_fields("input.init-on-submit");
    array_for_each(form.elements, function(element, index, array) {
        var result;
        if (pacform_representation_funcs.hasOwnProperty(element.type)) {
            result = bracket_data(
                pacform_representation_funcs[element.type](element));
        } else {
            result = null;
        }
        if (result) {
            numberMatch = /([0-9]+[a-z]?\.).*/.exec(element.name);
            var resultText;
            if (numberMatch) {
                resultText = numberMatch[1]+": "+result;
            } else {
                resultText = element.name+": "+result;
            }
            msg += "\r\n"+resultText;
        }
    });
    msg += "\r\n#EOF\r\n";
    set_form_data_div(msg);
    /* The init-on-submit fields should be reset to their default
    values so that they will be inited again next time the form is
    submitted. */
    var elem = document.querySelectorAll("input.init-on-submit");
    array_for_each(elem, function(element, index, array) {
        element.value = element.defaultValue;
    });
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
        element.value = value.trim();
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
            if (option.text == value) {
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
}


/* Initialize form from dictionary of settings

This function sets up a form with the contents of a fields object; it
determines which fields should be initialized by matching the
beginning of attribute againt the name of each field. */
function init_form_from_fields(fields, attribute) {
    for (var field in fields) {
        var elem = document.querySelectorAll("["+attribute+"^=\""+field+"\"]");
        array_for_each(elem, function (element) {
            if (init_from_msg_funcs.hasOwnProperty(element.type)) {
                return init_from_msg_funcs[element.type](element, fields[field]);
            }
        });
    }
}

/* Parse form field data from packet message
and initialize fields.

This function sets up a form with the contents of an already existing
form data message, which is passed in as text.  It is implemented as a
wrapper around init_form_from_fields. */
function init_form_from_msg_data(text) {
    var fields = parse_form_data_text(text);
    init_form_from_fields(fields, "name");
}


function parse_form_data_text(text) {
    var fields = {};
    var field_name = "";
    var field_value = "";
    for_each_line(text, function (linenum, line) {
        if (line.charAt(0) == "!" || line.charAt(0) == "#") {
            return;  // Ignore header and directives
        }
        var idx = 0;
        if (field_name == "") {
            idx = index_of_field_name_sep(linenum, line, idx);
            field_name = line.substring(0, idx);
            idx = index_of_field_value_start(linenum, line, idx) + 1;
        }
        end_idx = line.indexOf("]", idx);
        if (end_idx == -1) {
            // Field continues on next line
            field_value += line.substring(idx)
        } else {
            // Field is complete on this line
            field_value += line.substring(idx, end_idx);
            fields[field_name] = field_value;
            field_name = ""
            field_value = ""
        }
    });
    return fields;
}

function FormDataParseException(linenum, desc) {
    this.name = "FormDataParseException";
    this.linenum = linenum;
    this.message = "Parse error on line " + linenum.toString() + ": " + desc;
}

function index_of_field_name_sep(linenum, line, startAt) {
    var idx = line.indexOf(":", startAt)
    if (idx == -1) {
        throw new FormDataParseException(linenum, "no field name/value separator on line");
    }
    return idx;
}

function index_of_field_value_start(linenum, line, startAt) {
    var idx = line.indexOf("[", startAt);
    if (idx == -1) {
        throw new FormDataParseException(linenum, "no field value open bracket");
    }
    return idx;
}

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
    var text = get_form_data_from_div();
    if (text.trim().length != 0) {
        init_form_from_msg_data(text);
    } else {
        msgno = query_object['msgno'];
        if (msgno) {
            msg_url = "msgs/" + msgno;
            var msg_request = new XMLHttpRequest();
            msg_request.open("GET", msg_url, true);
            msg_request.responseType = "text";
            msg_request.onreadystatechange = function (e) {
                if (msg_request.readyState == msg_request.DONE) {
                    var text = msg_request.response;
                    if (text.trim().length > 0) {
                        set_form_data_div(text);
                        init_form_from_msg_data(text);
                    } else {
                        init_empty_form();
                    }
                }
            };
            try {
                msg_request.send(null);
            } catch (e) {
                init_empty_form();
            }
        } else {
            init_empty_form();
        }
    }
    next();
}

/* Handle form data message visibility */
function show_form_data() {
    var data_div = document.querySelector("#form-data");
    data_div.style.display = "block";
    data_div.tabIndex = "-1";
    data_div.focus();
    document.querySelector("#show-hide-data").value = "Hide Data Message";
    document.querySelector("#form-data").disabled = true;
}

function hide_form_data() {
    document.querySelector("#form-data").style.display = "none";
    document.querySelector("#show-hide-data").value = "Show Data Message";
    document.querySelector("#form-data").disabled = false;
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

/* Clear the form to original contents */
function clear_form() {
    document.querySelector("#the-form").reset();
    set_form_data_div("");
}

/* Utility: generate an object from the query string.  This should be
   called as an init function; it will store the result in the global
   variable query_object */
function query_string_to_object(next) {
    var query = {};
    string = window.location.search.substring(1);
    list = string ? string.split("&") : [];
    list.forEach(function(element, index, array) {
        list = element.split("=");
        query[list[0]] = decodeURIComponent(list[1].replace("+", "%20"));
    });
    query_object = query;
    next();
}
startup_functions.push(query_string_to_object);
startup_functions.push(init_form);

/* Disable "other" controls when not in use

This is a callback function to be used in the onChange handler of a
combobox; it will enable the relevant -other field if and only if the
combobox is set to "Other". */
function combobox_other_manager(e) {
    var other = document.querySelector("[name=\""+e.name+"-other\"]");
    if (e.value == "Other") {
        other.disabled = false;
    } else {
        other.disabled = true;
        other.value = "";
    }
}

function opdirect_submit(e) {
    write_pacforms_representation();
    hide_form_data();
    if (document.querySelector("#the-form").checkValidity()) {
        e.preventDefault();
        document.querySelector("#form-data-form").submit();
        return false;
    }
}

function stringify_possible_null(argument) {
    return argument ? argument : "";
}
