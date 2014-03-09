import sys, os.path, subprocess, shutil, winreg

def main():
    # The message should be saved in <script-path>/msgs/msgno
    base_directory = os.path.dirname(os.path.abspath(sys.argv[0]))
    directory = os.path.join(base_directory, "msgs");

    # The input filename is held in the third parameter
    filename = sys.argv[3]
    msgno = os.path.basename(filename).split("_")[0]
    qstring = "?mode=readonly&msgno="+msgno
    try:
        # Copy the input file to the directory with filename msgno
        shutil.copy(filename, os.path.join(directory,msgno))
    except Exception as e:
        print(e)

    # Which form to open a message with is determined by the "#
    # FORMFILENAME: " line in the input file
    file = open(filename)
    line = file.readline()
    while (not (line.startswith("# FORMFILENAME: ") or line == "")):
        line = file.readline();
    if (line == ""): # This is the end of the file, there is no FORMFILENAME
        return;
    else:
        # Must open it with the default browser
        regval = winreg.QueryValue(winreg.HKEY_CLASSES_ROOT,
                                   "\http\shell\open\command")
        form_filename = os.path.join(base_directory, line.split(":")[1].strip())
        subprocess.Popen([regval.split("\"")[1], "file:///"+form_filename + qstring])

main();
