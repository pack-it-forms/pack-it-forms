// Customize pack-it-forms for use in outpost-pacread <https://github.com/pack-it-forms/outpost-pacread>.

(function pacread() { // a scope

    /* Cross-browser resource loading w/local file handling

       This function uses an Msxml2.XMLHTTP ActiveXObject on Internet
       Explorer and a regular XMLHttpRequest in other places because using
       the ActiveXObject in Internet Explorer allows a file loaded through a
       file:// uri to access other resources through a file:// uri. */
    var open_async_request = function open_async_request(method, url, responseType, cb, err) {
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
    };

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

    /* Insert HTML include content in document

       This function process all of the HTML elements with an attribute named
       "data-include-html".  Each of these elements is replaced with the
       contents of outermost div in the the file:

       resources/html/<attribute value>.html

       If the replaced element contained body text that is a valid JSON
       object any fields in the included HTML that match the property names
       in the JSON objects will have their default values set to the
       corresponding property value. */
    var process_html_includes = function process_html_includes(next) {
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
    };

    /* --- Configuration data loading */

    /* Load the msgno prefix JSON file into a global variable

       This is run at startup, and loads the msgno prefix expansion JSON into
       a variable which can then by used by the msgno2name template filter to
       determine the location that a msgno prefix originates from. */
    var load_callprefix = function load_callprefix(next) {
        callprefixes = {};
        try {
            open_async_request("GET", "cfgs/msgno-prefixes.json", "text", function (data) {
                if (data) {
                    callprefixes = JSON.parse(data);
                }
                next();
            }, function () { next(); });
        } catch (e) {
            next();
        }
    };

    /** Maps from names used in a query string or !OUTPOST! message line
        to names used in envelope.sender and envelope.receiver.
    */
    var outpostNames = {
        msgno: "message_number",
        ocall: "operator_call_sign",
        oname: "operator_name",
        ordate: "date",
        ortime: "time"
    };

    var unwrap_pacform = function unwrap_pacform(message) {
        for_each_line(message, function(linenum, line) {
            if (line.match(/^!OUTPOST! /)) {
                line = line.substring(10); // Get rid of "!OUTPOST! "
                var pairs = line ? line.split(", ") : [];
                list.forEach(function(pair) {
                    var nameValue = pair.split("=");
                    var name = outpostNames[nameValue[0]];
                    if (name) {
                        envelope.sender[name] = nameValue.slice(1).join("=");
                    }
                });
            }
        });
    };

    var get_old_message = function get_old_message(next) {
        var query = query_string_to_object();
        envelope.viewer = query.msgno ? "receiver" : "sender";
        envelope.sender.message_number = query.msgno || "";
        envelope.readOnly = (query.mode == "readonly");
        for (q in query) {
            var name = outpostNames[q];
            if (name) {
                envelope[envelope.viewer][name] = query[q];
            }
        };
        if (envelope.viewer == "sender") {
            msgfields = {};
            next();
        } else {
            var msg_url = "msgs/" + envelope.sender.message_number;
            open_async_request("GET", msg_url, "text", function(message) {
                msgfields = get_message_fields(unwrap_message(message));
                unwrap_pacform(message);
                envelope.sender.message_number = msg_field("MsgNo");
                envelope.sender.operator_call_sign = msg_field("OpCall");
                envelope.sender.operator_name = msg_field("OpName");
                next();
            }, function() {
                throw("GET " + msg_url + " failed");
            });
        }
    };

    integration.expand_includes = process_html_includes;
    integration.load_configuration = load_callprefix;
    integration.get_old_message = get_old_message;
})();
