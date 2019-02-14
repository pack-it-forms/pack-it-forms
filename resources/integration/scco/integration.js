// Customize pack-it-forms for use in SCCoPIFO <https://github.com/jmkristian/OutpostForSCCo>

(function SCCoPIFO() {
    var environment = {{environment}};
    var status = environment.message_status;
    envelope.viewer = (status == 'read' || status == 'unread') ? 'receiver' : 'sender';
    envelope.readOnly = (environment.mode == 'readonly');
    if (environment.MSG_NUMBER == '-1') { // a sentinel value
        delete environment.MSG_NUMBER;
    }
    if (environment.MSG_LOCAL_ID == '-1') { // a sentinel value
        delete environment.MSG_LOCAL_ID;
    }

    var setDateTime = function setDateTime(into, from) {
        if (!from) return;
        var found = /(\S+)\s*(.*)/.exec(from);
        if (found) {
            into.date = found[1];
            into.time = found[2];
            found = /(\d+):(\d+)(:\d+)?([^\d]*)/.exec(into.time);
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
                into.time = hour + ':' + min + (sec ? sec : '');
            }
        }
    };
    setDateTime(envelope.sender, environment.MSG_DATETIME_OP_SENT);
    setDateTime(envelope.receiver, environment.MSG_DATETIME_OP_RCVD);

    var getOldMessage = function getOldMessage(next) {
        var message = {{message}};
        msgfields = get_message_fields(unwrap_message(message));
        var MsgNo = msg_field('MsgNo');
        var OpCall = msg_field('OpCall');
        var OpName = msg_field('OpName');
        if (envelope.viewer == 'receiver') {
            envelope.sender.message_number = MsgNo;
            envelope.sender.operator_call_sign = OpCall;
            envelope.sender.operator_name = OpName;
            envelope.receiver.message_number = environment.MSG_LOCAL_ID || '';
            envelope.receiver.operator_call_sign = environment.SETUP_ID_ACTIVE_CALL || '';
            envelope.receiver.operator_name = environment.SETUP_ID_ACTIVE_NAME || '';
        } else if (envelope.readOnly) { // The message has been sent already.
            envelope.sender.message_number = MsgNo;
            envelope.sender.operator_call_sign = OpCall;
            envelope.sender.operator_name = OpName;
            // TODO: set envelope.receiver.message_number
        } else {
            envelope.sender.message_number = environment.MSG_NUMBER || MsgNo;
            envelope.sender.operator_call_sign = environment.SETUP_ID_ACTIVE_CALL || OpCall;
            envelope.sender.operator_name = environment.SETUP_ID_ACTIVE_NAME || OpName;
        }

        // Change the message header from PACF format to ADDON format:
        newMessage.header = function() {
            return '!' + environment.addon_name + '!'
                + EOL + '# ' + document.title
                + EOL + '# JS-ver. PR-3.9-2.6, 08/11/13,'
                + EOL + '# FORMFILENAME: ' + environment.ADDON_MSG_TYPE
                + EOL + '# FORMVERSION: ' + form_version()
                + EOL + '# SUBJECT: ' + new_message_subject()
                + EOL;
        };
        newMessage.footer = '!/ADDON!\r\n';

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

    var customizeForm = function customizeForm(next) {
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

    integration.get_old_message = getOldMessage;
    integration.late_startup = customizeForm;
})();
