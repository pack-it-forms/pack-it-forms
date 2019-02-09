(function() {
    var message = {{message}};
    var environment = {{environment}};
    var status = environment.message_status;

    var setDateTime = function(into, from) {
        if (!from) return;
        var found = /(\S+)\s*(.*)/.exec(from);
        if (found) {
            into.ordate = found[1];
            into.ortime = found[2];
            found = /(\d+):(\d+)(:\d+)?([^\d]*)/.exec(into.ortime);
            if (found) {
                // convert to 24 hour time
                var hour = parseInt(found[1], 10);
                var min = found[2];
                var sec = found[3];
                var PM  = found[4].trim().toLowerCase() == 'pm';
                if (hour == 12) {
                    if (!PM) {
                        hour = 0;
                    }
                } else if (PM) {
                    hour += 12;
                } else if (hour < 10) {
                    hour = '0' + hour;
                }
                into.ortime = hour + ':' + min + (sec ? sec : '');
            }
        }
    };

    var getOldMessage = function(next) {
        viewer = (status == 'read' || status == 'unread') ? 'receiver' : 'sender';
        envelope.readOnly = (environment.mode == 'readonly');
        if (environment.MSG_NUMBER == '-1') { // a sentinel value
            delete environment.MSG_NUMBER;
        }
        if (environment.MSG_LOCAL_ID == '-1') { // a sentinel value
            delete environment.MSG_LOCAL_ID;
        }
        envelope.sender.msgno = environment.MSG_NUMBER || '';
        envelope.receiver.msgno = environment.MSG_LOCAL_ID || '';
        envelope[viewer].ocall = environment.SETUP_ID_ACTIVE_CALL || '';
        envelope[viewer].oname = environment.SETUP_ID_ACTIVE_NAME || '';
        setDateTime(envelope.sender, environment.MSG_DATETIME_OP_SENT);
        setDateTime(envelope.receiver, environment.MSG_DATETIME_OP_RCVD);

        // Change the message header from PACF format to ADDON format:
        newMessage.header = function() {
            return '!' + environment.addon_name + '!'
                + EOL + '# ' + document.title
                + EOL + '# JS-ver. PR-3.9-2.6, 08/11/13,'
                + EOL + '# FORMFILENAME: ' + environment.ADDON_MSG_TYPE
                + EOL + '# FORMVERSION: ' + formVersion()
                + EOL + '# SUBJECT: ' + newMessage.subject()
                + EOL;
        };
        newMessage.footer = '!/ADDON!\r\n';
        msgfields = oldMessage.get_fields(oldMessage.unwrap(message));

        if (environment.pingURL && !envelope.readOnly) {
            // Ping the server periodically, to keep it alive while the form is open.
            // But not for a read-only message.
            var ping_sequence = 0;
            setInterval(function() {
                var img = new Image();
                // To discourage caching, use a new query string for each ping.
                img.src = environment.pingURL + '?i=' + (ping_sequence++);
                img = undefined;
            }, 30000); // call ping every 30 seconds
        }
        next();
    };

    var customizeForm = function(next) {
        if (environment.submitURL) {
            document.querySelector('#form-data-form').action = environment.submitURL;
        }
        if (status == 'manual') {
            var submitButton = document.getElementById('opdirect-submit');
            if (submitButton) {
                submitButton.value = 'Create Message';
            }
        }
        if ((status == 'new' || status == 'draft') && envelope.readOnly) {
            // This message was just submitted to Outpost. Let the operator know:
            var div = document.createElement('div');
            div.style="position:absolute;height:20pt;top:50%;margin-top:-10pt;margin-left:5pt;font-weight:bold;";
            div.innerHTML =
                '<img src="icon-check.png" alt="OK" style="width:20pt;height:20pt;vertical-align:middle;">' +
                '&nbsp;&nbsp;The message has been submitted to Outpost. You can close this page.';
            document.getElementById('button-header').appendChild(div);
        }
        next();
    };

    before_integration("get_old_message", getOldMessage);
    before_integration("reveal_form", customizeForm);
})();
