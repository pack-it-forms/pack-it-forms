# Release packaging script
#
# This script should be run on a system with the bash provided
# by the GitHub git shell.  The system should have the 32-bit
# Python 3.4 with compatible versions of pywin32 and cx_Freeze
# installed and available on the path.
#
# The script should be called from the root directory of a
# checkout of pack-it-forms (the directory in which it resides).

version=$(cat "./VERSION")
distfile="pack-it-forms-${version}-win32.zip"

if [ -e "${distfile}" ]; then
    printf "Dist file already exists: %s\n" "${distfile}"
    exit 1
fi

tmpdir=$(mktemp -d -p .)
dest="${tmpdir}/pack-it-forms"
mkdir "${dest}"
git ls-files -z | xargs -0 -L 1 --replace=file install -D "file" "${dest}/file"
(cd "resources/scripts/pac-read" && python ./setup.py build)
cp -r "resources/scripts/pac-read/build" "${dest}/resources/scripts/pac-read/"
(cd "${tmpdir}" && powershell Compress-Archive -Path pack-it-forms -DestinationPath "..\\${distfile}")
rm -r ${tmpdir}
