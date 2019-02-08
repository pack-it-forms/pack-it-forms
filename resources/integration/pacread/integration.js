// Customize pack-it-forms for use in outpost-pacread <https://github.com/pack-it-forms/outpost-pacread>.

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
                    add_form_default_values(JSON.parse(defaults));
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

after_integration("expand_includes", process_html_includes);
after_integration("load_configuration", load_callprefix);
