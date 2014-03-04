function pacforms_header() {
    var header = "!PACF! "
    header += field_value("MsgNo");
    header += "_" + field_value("4.severity")[0];
    header += "/" + field_value("5.handling")[0];
    header += "_ICS213_"
    header += field_value("10.subject");
    header += "\n# EOC Message Form";
    header += "\n# JS-ver. PR-3.9-2.6, 08/11/13,";
    header += "\n# FORMFILENAME: Message.html";
    return header;
}
