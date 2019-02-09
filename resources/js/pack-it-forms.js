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
var viewer = "sender"; // or "receiver"
var envelope = {
    readOnly: false, // whether to show a read-only form.
    sender: {
        msgno: "",
        ocall: "",
        oname: "",
        ordate: "",
        ortime: ""
    },
    receiver: {
        msgno: "",
        ocall: "",
        oname: "",
        ordate: "",
        ortime: ""
    }
};
var callprefixes = {};     // Cached call prefixes for expansion
var msgfields = {};        // Field names and values from a message from Outpost.
var versions = {};         // Version information
var formDefaultValues;     // Initial values for form inputs. May contain templates.
var errorLog = [];         // Errors that occurred before there was a place to show them.
var EOL = "\r\n";

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

function link_to_PDF(URL) {
    after_integration("load_configuration", function(next) {
        document.getElementById("button-header").innerHTML +=
            '<input type="button" id="show-PDF-form" value="Show PDF"'
            + ' onclick="window.open(\'' + URL + '\', \'_blank\')"/>';
        next();
    });
}

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
    find_default_values();
    set_form_default_values();

    // Setup focus tracking within the form
    var the_form = document.querySelector("#the-form");
    last_active_form_element = document.activeElement;
    the_form.addEventListener("focus", function (ev) {
        last_active_form_element = ev.target;
    }, true);
    the_form.addEventListener("input", formChanged);

    /* Wait 10ms to force Javascript to yield so that the DOM can be
     * updated before we do other work. */
    window.setTimeout(function () {
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

function add_form_default_values(values) {
    if (!formDefaultValues) {
        formDefaultValues = {};
    }
    for (fieldName in values) {
        formDefaultValues[short_name(fieldName)] = values[fieldName];
    }
}

function set_form_default_values() {
    init_form_from_fields(formDefaultValues);
    init_form_from_fields(msgfields, true);
}

var oldMessage = { // a namespace

    /** Analyze the headers of the given message and store any data they contain.
        Return the body of the message, with headers and footers removed.
        May be replaced by an integration.
    */
    unwrap: function(message) {
        var body = "";
        for_each_line(message, function (linenum, line) {
            if (line.charAt(0) == "#") {
                return;  // Ignore "comments"
            }
            if (line.match(/^\s*$/)) {
                return;  // Ignore empty lines
            }
            if (line.match(/^!OUTPOST! /)) {
                // Grab outpost data fields and store for substitution
                var fromOutpost = outpost_envelope_to_object(line);
                for (var key in fromOutpost) {
                    envelope[viewer][key] = fromOutpost[key];
                }
                return;
            }
            if (line.match(/^!.*!/)) {
                return;  // Ignore line as we don't need anything from it.
            }
            body += line + EOL;
        });
        return body;
    },

    /** Return the fields from the given message body,
        in the form of an object {"fieldName": "fieldValue", ...}.
        May be replaced by an integration.
    */
    get_fields: function(body) {
        var fields = {};
        var field_name = "";
        var field_value = "";
        for_each_line(body, function (linenum, line) {
            var idx = 0;
            if (field_name == "") {
                idx = index_of_field_name_sep(linenum, line, idx);
                field_name = line.substring(0, idx);
                idx = index_of_field_value_start(linenum, line, idx) + 1;
            }
            var end_idx = line.indexOf("]", idx);
            if (end_idx == -1) {
                // Field continues on next line
                field_value += line.substring(idx);
            } else {
                // Field is complete on this line
                field_value += line.substring(idx, end_idx);
                fields[field_name] = field_value;
                field_name = "";
                field_value = "";
            }
        });
        return fields;
    }
};

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

/** Set the values of form fields and <span> elements.
    The object "fields" is {"field-name": fieldValue, ...}.
    The boolean "fromMessage" means "fields" was extracted from
    a message received from Outpost, in which case the values
    are not templates and will not be stored into elements
    with class="no-msg-init".
*/
function init_form_from_fields(fields, fromMessage) {
    if (!fields) return;
    for (var fieldName in fields) {
        var selected = document.querySelectorAll("[name^=\""+fieldName+"\"]");
        /* This CSS selector is a prefix match, which selects fields
           with short_name(element.name) == fieldName.
           Also, it may select a pair of elements, a <select> and
           an <input type="text"> with name = select.name + "-other",
           which offer the operator some convenient options plus
           a place to type in something else.
        */
        array_some(selected, function (element) {
            if (fromMessage && element.classList.contains("no-msg-init")) {
                return true;
            }
            var init = get_init_function(element);
            if (init) {
                var value = fields[fieldName];
                if (!fromMessage) {
                    value = expand_template(value);
                }
                var stop = init(element, value);
                fireEvent(element, 'change');
                return stop;
            } else {
                return false;
            }
        });
    }
}

function get_init_function(element) {
    var name = element.tagName.toUpperCase();
    if (init_from_msg_funcs.hasOwnProperty(name)) {
        return init_from_msg_funcs[name];
    }
    name = element.type;
    if (init_from_msg_funcs.hasOwnProperty(name)) {
        return init_from_msg_funcs[name];
    }
    return null;
}

/** Functions to set the value of an element. These are used to set
    a default value or a value extracted from a received message.
    They return true if the caller should not set the value of
    any other elements with the same name.
*/
var init_from_msg_funcs = {
    "SPAN": function(element, value) {
        try {
            element.innerHTML = value;
        } catch(err) {
            throw(element.name + ".innerHTML = " + JSON.stringify(value)
                  + ": " + err);
        }
        return true;
    },
    "text": function(element, value) {
        element.value = value;
        return true;
    },
    "textarea": function(element, value) {
        element.value = unescape_pacforms_string(value).trim();
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
        // A value from a received message will be "checked" (or absent).
        // A value from a data-default-value template may also be boolean.
        element.checked = (value != "false") && !!value;
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


/* --- Generate a message from form fields */

function write_pacforms_representation() {
    set_form_data_div(newMessage.text());
}

var newMessage = { // a namespace

    /** Construct a plain text message to submit to Outpost. */
    text: function() {
        return _toString(newMessage.header)
            + _toString(newMessage.body)
            + _toString(newMessage.footer);
    },

    /** Construct the header. May be replaced by an integration.
    */
    header: function() {
        var path = document.location.pathname;
        return '!PACF! ' + _toString(newMessage.subject)
            + EOL + "# " + document.title
            + EOL + "# JS-ver. PR-3.9-2.6, 08/11/13,"
            + EOL + "# FORMFILENAME: " + path.substr(path.lastIndexOf("/") + 1)
            + EOL + "# FORMVERSION: " + formVersion()
            + EOL;
    },

    footer: "#EOF\r\n",

    /** Construct the body. May be replaced by an integration. */
    body: function() {
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
                fldtxt += short_name(element.name) + ": " + result + EOL;
            }
        });
        return fldtxt;
    },

    /** Construct the subject. May be replaced by an integration. */
    subject: function() {
        return newMessage.subjectPrefix() + newMessage.subjectSuffix();
    },

    /** Construct the SCCo standard prefix of the subject.
        May be replaced by an integration.
    */
    subjectPrefix: function() {
        return field("MsgNo")
            + "_" + field("4.severity").substr(0, 1)
            + "/" + field("5.handling").substr(0, 1);
    },

    /** Construct the suffix of the subject of a SCCo ICS-213 message.
        May be replaced by an integration.
    */
    subjectSuffix: function() {
        return "_" + document.title.split(": ")[0]
            + "_" + field("10.subject");
    }
};

function _toString(arg) {
    switch(typeof arg) {
    case "string":
        return arg;
    case "function":
        return _toString(arg());
    default:
        return (arg == null) ? "" : arg + "";
    }
}

function short_name(name) {
    var numberMatch = /((?:[0-9]+[a-z]?\.)+).*/.exec(name);
    if (numberMatch) {
        return numberMatch[1];
    } else {
        return name;
    }
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
        data = data.trim();
        data = data.replace("`]", "``]");
        data = data.replace(/([^`])]/, "$1`]");
        return "[" + data + "]";
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

/** Expand a template string.
    A template starts with "$" and continues with a Javascript expression;
    this function returns the value of that expression.
    To simply define a string that starts with "$", insert another "$".
    For example, expand_template("$$ etc.") = "$ etc.".
 */
function expand_template(tmpl_str) {
    var result = tmpl_str;
    if (result && result.substr(0, 1) == "$" && result != "$") {
        result = result.substr(1);
        if (result.substr(0, 1) != "$") { // not a literal "$"
            try {
                result = eval(result);
            } catch(err) {
                throw "eval(" + JSON.stringify(result) + "): " + err;
            }
        }
    }
    return result;
}

function date() {
    var now = new Date();
    return (padded_int_str(now.getMonth()+1, 2) + "/"
            + padded_int_str(now.getDate(), 2) + "/"
            + padded_int_str(now.getFullYear(), 4));
}

function time() {
    var now = new Date();
    return (padded_int_str(now.getHours(), 2) + ":"
            + padded_int_str(now.getMinutes(), 2) + ":"
            + padded_int_str(now.getSeconds(), 2));
}

function field(name) {
    var result = "";
    var fields = document.getElementsByName(name);
    if (fields && fields.length > 0) {
        result = fields[0].value || "";
    }
    return result;
}

function msg_field(arg) {
    return (msgfields && msgfields[arg]) || "";
}

/** Return msg_field(msgFieldName) if the viewer sent the message,
    otherwise eturn return envelope[viewer][viewerFieldName].
    This is useful in footers that show what happened at this station;
    for example the name and call sign of either the operator who
    sent the message from this station or received it at this station.
 */
function msg_viewer_field(msgFieldName, viewerFieldName) {
    return (viewer == "sender" && envelope.readOnly && msg_field(msgFieldName))
        || envelope[viewer][viewerFieldName];
}

function msg_viewer_number(msgFieldName) {
    return (viewer == "sender" && msg_field(msgFieldName))
        || envelope[viewer].msgno;
}

function formVersion() {
    var includes = versions.includes.map(function(i) {
        return i.name + "=" + i.version;
    }).join(", ");
    return versions.form + "; " + includes;
}

function msgno2name(orig_value) {
    var name = callprefixes[orig_value.split('-')[0]];
    return name || "";
}

/** Find form text fields whose value is a template.
    "selector" (a CSS selector) specifies which fields to examine.
    "property" names the property that may be a template.
*/
function find_templated_text(selector, property) {
    var fields = document.querySelectorAll(selector);
    array_for_each(fields, function (field) {
        if (!field.classList.contains("no-load-init")) {
            var name = short_name(field.name || field.getAttribute("name"));
            var value = field[property];
            if (value && value.length > 1 && value.substr(0, 1) == "$") {
                // It's a template.
                if (!name) {
                    logError(field + " can't be initialized to " + value
                             + ", because it doesn't have a name.");
                } else if (formDefaultValues[name] == undefined) {
                    formDefaultValues[name] = value;
                }
            }
        }
    });
}


/* --- Form related utility functions */

/* Clear the form to original contents */
function clear_form() {
    var the_form = document.getElementById("the-form");
    the_form.reset();
    array_for_each(the_form.elements, function(element) {
        if (element.type) {
            if (element.type.substr(0, 8) == "textarea") {
                // Make Internet Explorer re-evaluate whether it's valid:
                var oldValue = element.value;
                element.value = oldValue + ".";
                element.value = oldValue;
            } else if (element.type == "checkbox" ||
                       element.type.substr(0, 6) == "select") {
                // Trigger any side-effects:
                fireEvent(element, "change");
            }
        }
    });
    set_form_default_values();
    formChanged();
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
function formChanged() {
    write_pacforms_representation();
    check_the_form_validity();
}

/* Function invoked when form is submitted */
function opdirect_submit(e) {
    write_pacforms_representation();
    hide_form_data();
    e.preventDefault();
    if (check_the_form_validity()) {
        integration.submit_to_outpost(function(){});
    }
    return false;
}

/* Function invoked when form is sent over email */
function email_submit(e) {
    hide_form_data();
    e.preventDefault();
    if (check_the_form_validity()) {
        // Use the same subject as Outpost
        document.location = "mailto:?to="
                          + "&Content-Type=text/plain"
                          + "&Subject=" + encodeURIComponent(newMessage.subject())
                          + "&body=" + encodeURIComponent(newMessage.text());
    }
    return false;
}

/* Disable "other" controls when not in use

This is a callback function to be used in the onChange handler of a
combobox; it will enable the relevant -other field if and only if the
combobox is set to "Other". */
function combobox_other_manager(source) {
    var targetActions = {};
    targetActions[source.name + "-other"] = {enable: true, require: true, otherwise: {value: ""}};
    return on_value(source, ["Other"], targetActions);
}

function on_value(source, valuesToMatch, targetActions) {
    return on_match(array_contains(valuesToMatch, source.value), targetActions);
}

function on_checked(checkbox, targetActions) {
    return on_match(checkbox.checked, targetActions);
}

/** For each targetName in targetActions, call
    set_properties(targetActions[targetName][match ? "onMatch" : "otherwise"].
    Use (match XOR targetActions[targetName].require) as the default value of required.
    Use !(match XOR targetActions[targetName].enable) as the default value of disabled.
    @return match
*/
function on_match(match, targetActions) {
    var targetProperties = {};
    for (var targetName in targetActions) {
        var actions = targetActions[targetName];
        var properties = actions[match ? "onMatch" : "otherwise"] || {};
        if (actions.enable !== undefined &&
            properties.disabled === undefined) {
            properties.disabled = !(match ? actions.enable : !actions.enable);
        }
        if (actions.require !== undefined &&
            properties.required === undefined) {
            properties.required = match ? actions.require : !actions.require;
        }
        targetProperties[targetName] = properties;
    }
    set_properties(targetProperties);
    return match;
}

/** For each targetName in targetProperties,
    copy targetProperties[targetName] into all elements of that name.
    Fire an input event for each changed value,
    and call check_the_form_validity if any value changed.
*/
function set_properties(targetProperties) {
    var changed = false;
    if (targetProperties) {
        for (var targetName in targetProperties) {
            var properties = targetProperties[targetName];
            array_for_each(document.getElementsByName(targetName), function(target) {
                for (var p in properties) {
                    if (properties[p] !== undefined) {
                        if (p == "value" && target.type == "radio") {
                            if (target.value == properties.value &&
                                !target.checked) {
                                target.checked = true;
                                changed = true;
                            }
                        } else if (target[p] != properties[p]) {
                            target[p] = properties[p];
                            changed = true;
                            if (p == "value") {
                                fireEvent(target, "input");
                            }
                        }
                    }
                }
            });
        }
    }
    if (changed) {
        check_the_form_validity();
    }
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
    if (envelope.readOnly) {
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
    var form = document.querySelector("#the-form");
    if (envelope.readOnly) {
        document.querySelector("#button-header").classList.add("readonly");
        hide_element(document.querySelector("#opdirect-submit"));
        hide_element(document.querySelector("#email-submit"));
        hide_element(document.querySelector("#show-hide-data"));
        hide_element(document.querySelector("#clear-form"));
        hide_element(document.querySelector("#show-PDF-form"));
        /* In view mode, we don't want to show the input control chrome.  This
           is difficult to do with textareas which might need scrollbars, etc.
           so insert a div with the same contents and use CSS to appropriately
           style it and hide the textarea. */
        var textareas_to_redisplay = [];
        array_for_each(form.elements, function (el) {
            if (el.placeholder) {
                el.placeholder = '';
            }
            el.tabIndex = "-1"; // Don't tab to this element.
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

function find_default_values() {
    if (!formDefaultValues) {
        formDefaultValues = {};
    }
    array_for_each(document.querySelectorAll("[data-default-value]"), function(field) {
        var name = short_name(field.name);
        if (formDefaultValues[name] == undefined) {
            formDefaultValues[name] = field.getAttribute("data-default-value");
        }
    });
    find_templated_text(".templated", "innerHTML");
    find_templated_text("input", "value");
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

function hide_element(element) {
    if (element) {
        element.hidden = "true";
        element.classList.add("hidden");
    }
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
    if (str == null) {
        return;
    }
    var linenum = 1;
    var last_idx = 0;
    var idx;
    while ((idx = str.indexOf("\n", last_idx)) >= 0) {
        var end = idx;
        if (end > 0 && str.substring(end - 1, end) == "\r") {
            end--;
        }
        func(linenum++, str.substring(last_idx, end));
        last_idx = idx + 1;
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

/* Initialize envelope from the query string. */
function query_string_to_object(next) {
    var string = window.location.search.substring(1);
    var list = string ? string.split("&") : [];
    list.forEach(function(element) {
        var pair = element.split("=");
        var name = decodeURIComponent(pair[0].replace("+", "%20"));
        var value = decodeURIComponent(pair[1].replace("+", "%20"));
        switch(name) {
        case "mode":
            if (value == "readonly") {
                envelope.readOnly = true;
            }
            break;
        default:
            envelope[viewer][name] = value;
        }
    });
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
    if (el) {
        el.textContent = el.textContent + msg + "\n";
        indicateError();
    } else {
        // The document isn't loaded yet.
        errorLog.push(msg);
        // integration.on_load will display it later.
    }
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

function advice_is_valid(advice, oldFunction, joinPoint) {
    if ((typeof oldFunction) != "function") {
        logError(joinPoint + " is not a customizable function.");
    } else if ((typeof advice) != "function") {
        logError(JSON.stringify(advice) + " can't customize " + joinPoint + ".");
    } else {
        return true;
    }
    return false;
}

/** Customize integration[joinPoint] so it calls advice(next) first.
    The function advice(next) must either call next() or throw an exception.
*/
function before_integration(joinPoint, advice) {
    var oldFunction = integration[joinPoint];
    if (advice_is_valid(advice, oldFunction, "integration." + joinPoint)) {
        integration[joinPoint] = function(next) {
            advice(function() {
                oldFunction(next);
            });
        };
    }
}

/** Customize integration[joinPoint] so it calls advice(next) afterward.
    The function advice(next) must either call next() or throw an exception.
*/
function after_integration(joinPoint, advice) {
    var oldFunction = integration[joinPoint];
    if (advice_is_valid(advice, oldFunction, "integration." + joinPoint)) {
        integration[joinPoint] = function(next) {
            oldFunction(function() {
                advice(next);
            });
        };
    }
}

function call_integration(joinPoint) {
    return function(next) {
        integration[joinPoint](next);
    };
    // The purpose here is to read integration[joinPoint]
    // *after* integration.js and forms have customized it;
    // which they do after the startup_functions are initialized.
}

/* --- Registration of startup functions that run on page load */

startup_functions.push(call_integration("on_load"));
startup_functions.push(load_form_version);
startup_functions.push(call_integration("expand_includes"));
startup_functions.push(query_string_to_object);
startup_functions.push(call_integration("load_configuration"));
startup_functions.push(call_integration("get_old_message"));
startup_functions.push(init_form);
startup_functions.push(setup_input_elem_from_class);
// This must come after query_string_to_object in the startup functions
startup_functions.push(setup_view_mode);
// These must be the last startup functions added
//startup_functions.push(startup_delay);  // Uncomment to test loading overlay
//startup_functions.push(test_error);  // Uncomment to test startup err report
startup_functions.push(setup_error_indicator);
startup_functions.push(call_integration("reveal_form"));

/** Integration points.
    Each function must either call next() or throw an exception.
    An integration or form will typically customize some of them, with
    Javascript code that calls before_integration or after_integration.
 */
var integration = {

    /** Called shortly after window.onload. */
    on_load: function(next) {
        array_for_each(errorLog, function(err) {
            logError(err);
        });
        errorLog = [];
        next();
    },

    /** Assemble included files into a single HTML document. */
    expand_includes: function(next) {
        next();
    },

    /** Load configuration data. */
    load_configuration: function(next) {
        next();
    },

    /** Fetch and analyze the text message received from Outpost,
        store the message field names and values into msgfields,
        and possibly change other configuration data.
     */
    get_old_message: function(next) {
        next();
    },

    /** Reveal the form to the operator; that is take away the "loading" spinner. */
    reveal_form: function(next) {
        remove_loading_overlay(next);
    },

    /** Submit a message to Outpost. */
    submit_to_outpost: function(next) {
        document.querySelector("#form-data-form").submit();
        next();
    }
};
