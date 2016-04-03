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

import sys, os, os.path, subprocess, shutil
try:
    import winreg
except ImportError as e:
    class winreg:
        "Dummy winreg class to allow testing on Linux"
        @staticmethod
        def QueryValue(tree, var):
            return "\"firefox"
        HKEY_CLASSES_ROOT=""

# Assume the original PacFORMS pac-read.exe was renamed
# pac-read-pacforms.exe in the same directory and this script replaced
# it.
script_directory = os.path.dirname(os.path.abspath(sys.argv[0]))
original_pacread_exe = os.path.join(script_directory, "pac-read-pacforms.exe")

# If an environment variable named PACKITFORMS_BASE exists, use
# that as the location of pack-it-forms.  Otherwise assume that
# this directory in which this script was run is the location
# of pack-it-forms.
try:
    base_directory = os.environ["PACKITFORMS_BASE"]
except KeyError:
    base_directory = script_directory
msg_directory = os.path.join(base_directory, "msgs");

debug_logfile = None

def main():
    try:
        if os.environ["PACKITFORMS_LOGLEVEL"] == "DEBUG":
            debug_open()
    except KeyError:
        pass

    debug("pac-read started as: {!r}", sys.argv)
    # The message data input filename is held in the third parameter
    msg_filename = sys.argv[3]
    msgno = os.path.basename(msg_filename).split("_")[0]
    form_filename = form_filename_from_msg(msg_filename)
    if form_filename and os.path.exists(form_filename):
        pack_it_forms_handler(form_filename, msg_filename, msgno)
    else:
        pacforms_handler()

def debug_open():
    global debug_logfile
    if debug_logfile:
        debug("debug_open() called on an already open file")
    else:
        debug_logfile = open(os.path.join(base_directory, 'pac-read.log'), 'a')
        debug("Opening debug log file")

def debug(fmt, *arg):
    global debug_logfile
    if debug_logfile:
        fmt = fmt + '\n'
        debug_logfile.write(fmt.format(*arg))
        debug_logfile.flush()

def debug_close():
    global debug_logfile
    if debug_logfile:
        debug("Closing debug log file")
        debug_logfile.close()

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
    global msg_directory
    debug("opening pack-it-form {!r} for msgno {!r} using data in {!r}",
                 form_filename, msgno, msg_filename)
    try:
        # Copy the input file to the msg directory with filename msgno
        shutil.copy(msg_filename, os.path.join(msg_directory, msgno))
    except Exception as e:
        print(e)
        sys.exit(1)
    url = "file:///" + form_filename + "?mode=readonly&msgno=" + msgno
    # Must open it with the default browser
    regkey = "\http\shell\open\command"
    regval = winreg.QueryValue(winreg.HKEY_CLASSES_ROOT, regkey)
    sys.exit(subprocess.call([regval.split("\"")[1], url]))

def pacforms_handler():
    global original_read_exe
    sys.argv[0] = original_pacread_exe
    debug("running PacFORMS pac-read as: {!r}", sys.argv)
    sys.exit(subprocess.call(sys.argv))

main();
