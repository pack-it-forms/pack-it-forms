import sys
from cx_Freeze import setup, Executable

build_exe_options = {"packages": ["sys", "os", "subprocess", "shutil",
                                  "winreg", "configparser", "datetime"]}
setup (name = "pac-read",
       version = "0.0.8",
       description = "pack-it-forms form display wrapper for PacFORMS pac-read.exe",
       authors = "pack-it-forms development team",
       options = {"build_exe": build_exe_options},
       executables = [Executable("pac-read.py")])
