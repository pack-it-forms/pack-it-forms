# Copyright 2014, 2015, 2016 Keith Amidon
# Copyright 2014, 2015, 2016 Peter Amidon
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# This script is a wrapper for the PacFORMS pac-read.exe program to
# enable Outpost to open both PacFORMS messages and pack-it-forms
# messages by calling a single executable.  When called, it checks to
# see if there is a pack-it-forms form with the filename provided in
# the message.  If there is it copies the message data to the
# pack-it-forms msg directory and opens the form.  If not, it calls
# the original pac-read.exe with the same arguments it was called with.

import sys, os, os.path, subprocess, shutil, configparser, datetime, traceback
import re

try:
    import winreg
except ImportError as e:
    class winreg:
        "Dummy winreg class to allow testing on Linux"
        @staticmethod
        def QueryValue(tree, var):
            return '"firefox" "%1"'
        HKEY_CLASSES_ROOT=""

HKEY_NAMES = {
    winreg.HKEY_CURRENT_USER: "HKEY_CURRENT_USER",
    winreg.HKEY_LOCAL_MACHINE: "HKEY_LOCAL_MACHINE",
    winreg.HKEY_CLASSES_ROOT: "HKEY_CLASSES_ROOT"
}

# Assume the original PacFORMS pac-read.exe was renamed
# pac-read-pacforms.exe in the same directory and this script replaced
# it.
script_directory = os.path.dirname(os.path.abspath(sys.argv[0]))
original_pacread_exe = os.path.join(script_directory, "pac-read-pacforms.exe")

base_directory = os.environ.get("PACKITFORMS_BASE")
if base_directory:
    config_filename = os.path.join(base_directory, "CONFIG")
    version_filename = os.path.join(base_directory, "VERSION")
    msg_directory = os.path.join(base_directory, "msgs")
else:
    config_filename = None
    version_file = None
    msg_directory = None

debug_logfile = None
config = {}

def main():
    read_config()
    verify_environment()
    version = get_version()
    debug("pac-read {!s} started as: {!r}", version, sys.argv)
    if len(sys.argv) == 2 and sys.argv[1] == "--pack-it-forms-version":
        print("pack-it-forms version: {!s}".format(version))
        sys.exit(0)

    if len(sys.argv) == 4:
        # The message data input filename is held in the third parameter
        msg_filename = sys.argv[3]
        msgno = os.path.basename(msg_filename).split("_")[0]
        form_filename = form_filename_from_msg(msg_filename)
        if form_filename and os.path.exists(form_filename):
            pack_it_forms_handler(form_filename, msg_filename, msgno)
        else:
            pacforms_handler()
    else:
        pacforms_handler()

def read_config():
    global config
    global config_filename
    parser = configparser.ConfigParser(strict=False, interpolation=None,
                                       default_section=None)
    # Silently ignore a non-existent file
    if config_filename:
        parser.read(config_filename)

    debug_default = os.environ.get("PACKITFORMS_LOGLEVEL") == "DEBUG"
    config["debug"] = parser.getboolean("pac-read", "debug",
                                        fallback=debug_default)
    if config["debug"]:
        debug_open()
    if config_filename and os.path.exists(config_filename):
        debug("Found config file at {!r}", config_filename)

    config["exhaustive_registry_check"] = parser.getboolean("pac-read",
                                                   "exhaustive_registry_check",
                                                   fallback=False)
    config["browser_cmd_fmt"] = parser.get("pac-read", "browser_cmd_fmt",
                                           fallback=registry_browser_cmd_fmt())
    debug("Final command format: {!s}", config["browser_cmd_fmt"])

def debug_open():
    global debug_logfile
    if debug_logfile:
        debug("debug_open() called on an already open file")
    else:
        if base_directory:
            debug_logfile = open(os.path.join(base_directory, 'pac-read.log'), 'a')
            debug("Opening debug log file")

def debug(fmt, *arg):
    global debug_logfile
    if debug_logfile:
        ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f ")
        lines = fmt.format(*arg).split("\n")
        for l in lines:
            if l.strip():
                debug_logfile.write("{!s} {!s}\n".format(ts, l))
        debug_logfile.flush()

def debug_close():
    global debug_logfile
    if debug_logfile:
        debug("Closing debug log file")
        debug_logfile.close()

def registry_browser_cmd_fmt():
    global config
    exhaustive_msg = ""
    if config["exhaustive_registry_check"]:
        exhaustive_msg = " (exhaustively)"
    debug("Searching for browser command format in registry{!s}",
          exhaustive_msg)
    options = []
    cmd = None
    for f in [ registry_browser_from_firefox_url_class_search,
               registry_browser_from_http_user_choice,
               registry_browser_from_http_class_search ]:
        cmd = f()
        if cmd:
            options.append(cmd)
            if not config["exhaustive_registry_check"]:
                break
    if options:
        debug("Registry search result: {!s}", options[0])
        return options[0]
    else:
        return None

def registry_browser_from_firefox_url_class_search():
    debug("Checking for Firefox URL class entries")
    global HKEY_NAMES
    global config
    options = []
    matches = registry_find_matching_subkey(winreg.HKEY_CURRENT_USER,
                                            "\\Software\\Classes",
                                            r"FirefoxURL(-[0-9a-fA-F]+)?")
    matches += registry_find_matching_subkey(winreg.HKEY_LOCAL_MACHINE,
                                             "\\Software\\Classes",
                                             r"FirefoxURL(-[0-9a-fA-F]+)?")
    matches += registry_find_matching_subkey(winreg.HKEY_CLASSES_ROOT,
                                             "",
                                             r"FirefoxURL(-[0-9a-fA-F]+)?")
    if matches:
        for (category, keypath) in matches:
            key = keypath + "\\shell\\open\\command"
            cmd = registry_get_key_with_default(category, key)
            if cmd:
                options.append((category, key, cmd))
                if not config["exhaustive_registry_check"]:
                    break
    if options:
        debug("Selected {!s}{!s} = {!r}",
              HKEY_NAMES[options[0][0]], options[0][1], options[0][2])
        return options[0][2]
    else:
        debug("None found")
        return None

def registry_browser_from_http_user_choice():
    debug("Checking HTTP user choice association")
    global HKEY_NAMES
    cmd = None
    key = "\\Software\\Microsoft\\Windows\\Shell\\Associations"
    key += "\\UrlAssociations\\http\\UserChoice\\ProgId"
    choice = registry_get_key_with_default(winreg.HKEY_CURRENT_USER, key)
    if choice:
        key = "\\" + choice + "\\shell\\open\\command"
        cmd = registry_get_key_with_default(winreg.HKEY_CLASSES_ROOT, key)
    if cmd:
        debug("Selected {!s}{!s} = {!r}",
              HKEY_NAMES[winreg.HKEY_CLASSES_ROOT], key, cmd)
    else:
        debug("None found")
    return cmd

def registry_browser_from_http_class_search():
    debug("Checking for HTTP class values")
    global HKEY_NAMES

    keys_to_check = [
          (winreg.HKEY_CURRENT_USER,
           "\\Software\\Classes\\http\\shell\\open\\command"),
          (winreg.HKEY_LOCAL_MACHINE,
           "\\Software\\Classes\\http\\shell\\open\\command"),
          (winreg.HKEY_CLASSES_ROOT,
           "\\http\\shell\\open\\command")
        ]
    cmd = registry_get_first_key(keys_to_check)
    return cmd

def registry_find_matching_subkey(category, keypath, regexp):
    global HKEY_NAMES
    matches = []
    pattern = re.compile(regexp)
    debug("Searching {!s}{!s} for keys in {!r}", HKEY_NAMES[category], keypath, regexp)
    keyobjs = registry_open_keypath(category, keypath)
    if keyobjs:
        try:
            i = 0
            while True:
                try:
                    subkey = winreg.EnumKey(keyobjs[0], i)
                except EnvironmentError:
                    break  # Checked all entries"
                else:
                    if pattern.fullmatch(subkey):
                        matches.append((category, keypath + "\\" + subkey))
                        debug("Found {!s}{!s}\\{!s}", HKEY_NAMES[category], keypath, subkey)
                    i += 1
        finally:
            registry_close_keypath(keyobjs)
    else:
        debug("Path doesn't exist")
    return matches

def registry_open_keypath(category, keypath):
    keyobjs = []
    current = category
    for n in keypath.split("\\"):
        try:
            current = winreg.OpenKey(current, n)
        except FileNotFoundError:
            registry_close_keypath(keyobjs)
            return None
        else:
            keyobjs.insert(0, current)
    return keyobjs


def registry_close_keypath(keyobjs):
    if keyobjs:
        for k in keyobjs:
            winreg.CloseKey(k)

def registry_get_first_key(key_tuple_list):
    global HKEY_NAMES
    global config
    options = []
    for (category, keypath) in key_tuple_list:
        v = registry_get_key_with_default(category, keypath)
        if v:
            options.append((category, keypath, v))
            if not config["exhaustive_registry_check"]:
                break
    if options:
        debug("Selected {!s}{!s} = {!r}",
              HKEY_NAMES[options[0][0]], options[0][1], options[0][2])
        return options[0][2]
    else:
        debug("None found")
        return None

def registry_get_key_with_default(category, keypath, default=None):
    global HKEY_NAMES
    global config
    keyobjs = registry_open_keypath(category, keypath)
    if keyobjs:
        try:
            value = winreg.QueryValue(keyobjs[0], "")
        finally:
            registry_close_keypath(keyobjs)
        if config["exhaustive_registry_check"]:
            debug("{!s}{!s} = {!r}", HKEY_NAMES[category], keypath, value)
        return value
    else:
        if config["exhaustive_registry_check"]:
            debug("{!s}{!s} not found, returning default {!r}",
                  HKEY_NAMES[category], keypath, default)
        return default

def verify_environment():
    global base_directory
    global version_filename
    global msg_directory
    global config_filename
    global config
    base_err = False
    install_err = False
    script_err = False
    browser_err = False
    if not base_directory:
        debug("PACKITFORMS_BASE environment variable is not set")
        print("""
The PACKITFORMS_BASE environment variable is not set.

This variable must be set and point to the directory where pack-it-forms
is installed.

""")
        sys.exit(1)
    if not os.path.isdir(base_directory):
        debug("Base directory does not exit: {!r}", base_directory)
        if not base_err:
              print("""\
The directory specified in the PACKITFORMS_BASE environment variable
does not exit:

   {!s}

""".format(base_directory))
        base_err = True
    if not os.path.isfile(version_filename):
        debug("Version file does not exist: {!r}", version_filename)
        if not base_err:
              print("""
The directory specified in PACKITFORMS_BASE does not have a VERSION
file at:

   {!s}

Are you sure that PACKITFORMS_BASE is set to the correct directory?

""".format(version_filename))
        install_err = True

    if not os.path.isdir(msg_directory):
        debug("Message directory does not exist: {!r}", msg_directory)
        if not (base_err or install_err):
              print("""
The directory specified in PACKITFORMS_BASE does not have a msgs
subdirectory at:

   {!s}

Are you sure that PACKITFORMS_BASE is set to the correct directory?

""".format(msg_directory))
        install_err = True
    if not os.path.isfile(original_pacread_exe):
        debug("Original PacFORMS pac-read.exe not at: {!r}",
              original_pacread_exe)
        print("""
The original PacFORMS pac-read.exe does not exist at:

   {!s}

Are you sure that you copied the original pac-read.exe file to
that location and replaced it with this script?

""".format(original_pacread_exe))
        script_err = True
    if not config["browser_cmd_fmt"]:
        debug("No browser command was found or configured.")
        print("""
Could not determine a browser command.

Try setting a browser in the file:

   {!s}

It should be formatted like:

[pac-read]
browser_cmd_fmt = "C:\\Program Files (x86)\\Firefox\\Firefox.exe" --url "%1"

""".format(config_filename))
        browser_err = True
    if base_err or install_err or script_err or browser_err:
        sys.exit(1)

def get_version():
    global version_filename
    try:
        f = open(version_filename, "r")
        v = f.readline().rstrip()
        return v
    except Exception as e:
        debug("Ignoring exception while getting version\n{!s}",
              traceback.format_exc())
        return "unknown"

def form_filename_from_msg(filename):
    global base_directory
    # Which form to open a message with is determined by the "#
    # FORMFILENAME: " line in the input file
    file = open(filename)
    line = file.readline()
    while (not (line.startswith("# FORMFILENAME: ") or line == "")):
        line = file.readline();
    if (line == ""): # This is the end of the file, there is no FORMFILENAME
        debug("Msg doesn't specify form file: {!r}", filename)
        return None;
    return os.path.join(base_directory, line.split(":")[1].strip())

def pack_it_forms_handler(form_filename, msg_filename, msgno):
    debug("opening pack-it-form {!r} for msgno {!r} using data in {!r}",
                 form_filename, msgno, msg_filename)
    copy_msg_to_msgno_in_pack_it_forms_msgs_dir(msg_filename, msgno)
    url = "file:///" + form_filename + "?mode=readonly&msgno=" + msgno
    retcode = open_pack_it_forms_msg_in_browser(url)
    if retcode != 0:
        debug("browser returned error code {!r}", retcode)
    sys.exit(retcode)

def copy_msg_to_msgno_in_pack_it_forms_msgs_dir(msg_filename, msgno):
    global msg_directory
    dst_filename = os.path.join(msg_directory, msgno)
    if os.path.abspath(msg_filename) != os.path.abspath(dst_filename):
        debug("Copying msg from {!r} to {!r}", msg_filename, dst_filename)
        shutil.copy(msg_filename, dst_filename)
    else:
        debug("Skipping copy as supplied file is already in msgs dir.")

def open_pack_it_forms_msg_in_browser(url):
    cmd = format_browser_cmd(url)
    debug("opening pack-it-forms form in browser as: {!r}", cmd)
    return subprocess.call(cmd)

def format_browser_cmd(url):
    # Ugly hand-written parser for windows command quoting as
    # described in:
    # https://docs.python.org/3/library/subprocess.html#converting-an-argument-sequence-to-a-string-on-windows
    global config
    cmd = []
    arg = ""
    pending_backslash = False
    pending_percent = False
    in_quotes = False
    last_was_quote = False
    for c in config["browser_cmd_fmt"]:
        if c == '\\':
            if pending_percent:
                arg += '%'
                pending_percent = False
            if pending_backslash:
                arg += '\\\\'
                pending_backslash = False
            else:
                pending_backslash = True
            last_was_quote = False
        elif c == '"':
            if pending_percent:
                arg += '%'
                pending_percent = False
            if pending_backslash:
                arg += '"'
                pending_backslash = False
            else:
                in_quotes = not in_quotes
            last_was_quote = True
        elif c == '%':
            if pending_backslash:
                arg += '\\%'
                pending_backslash = False
            if pending_percent:
                arg += '%%'
                pending_percent = False
            else:
                pending_percent = True
            last_was_quote = False
        elif c == '1':
            if pending_backslash:
                arg += '\\'
                pending_backslash = False
            if pending_percent:
                arg += url
                pending_percent = False
            else:
                arg += '1'
            last_was_quote = False
        elif c == ' ' or c == '\t':
            if pending_backslash:
                arg += '\\'
                pending_backslash = False
            if pending_percent:
                arg += '%'
                pending_percent = False
            if in_quotes:
                arg += c
            else:
                if len(arg) > 0 or last_was_quote:
                    cmd.append(arg)
                    arg = ''
            last_was_quote = False
        else:
            if pending_backslash:
                arg += '\\'
                pending_backslash = False
            if pending_percent:
                arg += '%'
                pending_percent = False
            arg += c
            last_was_quote = False
    if pending_backslash:
        arg += '\\'
        pending_backslash = False
    if pending_percent:
        arg += '%'
        pending_percent = False
    if len(arg) > 0 or last_was_quote:
        cmd.append(arg)
        arg = ''
    return cmd

def pacforms_handler():
    global original_read_exe
    sys.argv[0] = original_pacread_exe
    debug("running PacFORMS pac-read as: {!r}", sys.argv)
    retcode = subprocess.call(sys.argv)
    if retcode != 0:
        debug("PacFORMS pac-read.exe returned error code {!r}", retcode)
    sys.exit(retcode)

try:
    main();
except Exception as e:
    debug("Exception caught at top level\n{!s}", traceback.format_exc())
    raise e
