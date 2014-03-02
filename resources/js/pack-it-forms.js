/* Common code for handling PacFORMS forms */

/* Registry for functions to execute when the form is loaded. */
var startup_functions = new Array();

function startup() {
    startup_functions.forEach(function (f) { f(); });
}

window.onload=startup;


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
        field.value = now.toLocaleTimeString();
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

/* Parse form field data from packet message and initialize fields.

This function sets up a form with the contents of an already existing
form data message, which is stored in a div in the document with the
ID "formdata". */
function init_form_from_msg_data() {
}

startup_functions.push(init_text_fields)

