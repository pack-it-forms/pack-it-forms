(function() {
    var message = {{message}};
    var envelopeDefaults = {{envelopeDefaults}};
    var queryDefaults = {{queryDefaults}};
    before_integration("load_configuration", function(next) {
        set_form_data_div(message || '# A new message will go here.');
        for (var e in envelopeDefaults) {
            if (!(e in outpost_envelope)) {
                outpost_envelope[e] = envelopeDefaults[e];
            }
        }
        for (var q in queryDefaults) {
            if (!(q in query_object)) {
                query_object[q] = queryDefaults[q];
            }
        }
        if (query_object.submitURL) {
            document.querySelector('#form-data-form').action = query_object.submitURL;
        }
        if (query_object.pingURL && query_object.mode != 'readonly') {
            // Ping the server periodically, to keep it alive while the form is open.
            // But not for a read-only message.
            var ping_sequence = 0;
            setInterval(function() {
                var img = new Image();
                // To discourage caching, use a new query string for each ping.
                img.src = query_object.pingURL + '?i=' + (ping_sequence++);
                img = undefined;
            }, 30000); // call ping every 30 seconds
        }
        var status = query_object.message_status;
        // Show Rec-Sent based on whether we received this message:
        init_form_from_fields({'Rec-Sent': (status == 'unread' || status == 'read') ? 'Received' : 'Sent'}, 'name');
        array_for_each(document.getElementsByName('Rec-Sent'), function(recSent) {
            recSent.disabled = true; // Don't include it in transmitted messages.
            recSent.classList.add('no-msg-init'); // Ignore it in received messages.
            // That is, init_form_from_fields won't affect this element any more.
        });
        // Change the message header from PACF format to ADDON format:
        var messageHeader = document.getElementById('message-header');
        var header = messageHeader.textContent;
        // The subject comes after !PACF! in the first line:
        var foundSubject = /^\s*![^!\r\n]*![ \t]*([^\r\n]*)/.exec(header);
        if (foundSubject) {
            // Add the subject in a comment:
            header = header.replace(/\s*$/, '\r\n# SUBJECT: ' + foundSubject[1]);
            // Replace that first line:
            header = header.replace(/^\s*![^\r\n]*([\r\n])/,
                                    '!' + query_object.addon_name + '!$1');
        }
        // Correct FORMFILENAME:
        header = header.replace(/([\r\n]#[ \t]*FORMFILENAME[ \t]*:)[^\r\n]*/,
                                '$1 ' + query_object.filename);
        messageHeader.textContent = header;
        outpost_message_footer = '!/ADDON!\r\n';
        if (status == 'manual') {
            var submitButton = document.getElementById('opdirect-submit');
            if (submitButton) {
                submitButton.value = 'Create Message';
            }
        }
        if ((status == 'new' || status == 'draft') &&
            query_object.mode == 'readonly') {
            // This message was just submitted to Outpost. Let the operator know:
            var div = document.createElement('div');
            div.style="position:absolute;height:20pt;top:50%;margin-top:-10pt;margin-left:5pt;font-weight:bold;";
            div.innerHTML =
                '<img src="icon-check.png" alt="OK" style="width:20pt;height:20pt;vertical-align:middle;">' +
                '&nbsp;&nbsp;The message has been submitted to Outpost. You can close this page.';
            document.getElementById('button-header').appendChild(div);
        }
        next();
    });
})();
