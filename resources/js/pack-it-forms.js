/* Common code for handling PacFORMS forms */

/* Registry for functions to execute when the form is loaded. */
var startup_functions = new Array();

function startup() {
    startup_functions.forEach(function (f) { f(); });
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

/* Functions for initializing text fields with class 'init-default'.

The initialization function is selected using the contents of the
value attribute of the field's input DOM object looked up in the
text_field_init_funcs.  By convention, for easy of recognition in the
form HTML source, the initialization name is wrapped in square
brackets. */
var text_field_init_func = {
    "[date]" : function (field) {
        var now = new Date();
        field.value = now.toLocaleDateString();
    },

    "[time]" : function (field) {
        var now = new Date();
        field.value =
            padded_int_str(now.getHours(), 2) + ":" +
            padded_int_str(now.getMinutes(), 2) + ":" +
            padded_int_str(now.getSeconds(), 2);
    },
    "[msgno]" : function (field) {
        field.value = document.location.hash.slice(1);
    }
}

function init_text_fields() {
    // TODO: replace with forEach somehow?  NodeLists don't support by default.
    var fields = document.querySelectorAll("input.init-default");
    for (var i = 0; i < fields.length; i++) {
        var init_type = fields[i].value;
        if (text_field_init_func.hasOwnProperty(init_type)) {
            text_field_init_func[init_type](fields[i]);
        }
    }
}

/* Initialize an empty form

This function sets up a new empty form. */
function init_empty_form() {
    init_text_fields();
}

function get_form_data_from_div() {
    return document.querySelector("#form-data").textContent;
}

function set_form_data_div(text) {
    document.querySelector("#form-data").textContent = text;
}

/* Parse form field data from packet message and initialize fields.

This function sets up a form with the contents of an already existing
form data message, which is stored in a div in the document with the
ID "formdata". */
function init_form_from_msg_data(text) {
    console.log("init_form_from_msg_data not yet implemented");
}

/* Initialize a form

The form field values will either be set from the form data message
contents found in one of these locations in order of preference:

1. the textContent of the div with ID "form-data"
2. a file at the location "msgs/<fragment-id>", where <fragment-id>
   is the fragment identifier from the URL of the document.

If no form data exists in any of these locations a new form will be
filled with default contents. */
function init_form() {
    var text = get_form_data_from_div();
    if (text.trim().length != 0) {
        init_form_from_msg_data(text);
    } else {
        msgno = document.location.hash.slice(1);
        if (msgno.length > 0) {
            msg_url = "msgs/" + msgno;
            console.log("requesting form data message url:", msg_url);
            var msg_request = new XMLHttpRequest();
            msg_request.open("GET", msg_url, true);
            msg_request.responseType = "text";
            msg_request.onreadystatechange = function (e) {
                console.log("msg_request state: ", msg_request.readyState);
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
                console.log("Error in form_data_msg_url request: ", e);
                init_empty_form();x
            }
        } else {
            init_empty_form();
        }
    }
}

/* Handle form data message visibility */
function show_form_data(e) {
    var data_div = document.querySelector("#form-data");
    data_div.style.display = "block";
    data_div.tabIndex = "-1";
    data_div.focus();
    e.value = "Hide Data Message";
}

function hide_form_data(e) {
    document.querySelector("#form-data").style.display = "none";
    e.value = "Show Data Message";
}

function toggle_form_data_visibility(e) {
    var data_div = document.querySelector("#form-data");
    console.log(data_div.style.display);
    if (data_div.style.display == "none"
        || data_div.style.display == "") {
        show_form_data(e);
    } else {
        hide_form_data(e);
    }
}

/* Clear the form to original contents */
function clear_form() {
    document.querySelector("#the-form").reset();
    set_form_data_div("");
}

window.onhashchange = function () {
    clear_form();
    init_form();
};
startup_functions.push(init_form);
