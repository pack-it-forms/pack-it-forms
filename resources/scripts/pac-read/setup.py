import sys
from cx_Freeze import setup, Executable

build_exe_options = {"packages": ["sys", "os", "subprocess", "shutil", "winreg"]}
setup (name = "pac-read",
       options = {"build_exe": build_exe_options},
       executables = [Executable("pac-read.py")])
