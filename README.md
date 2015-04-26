pack-it-forms
=============

Inspired by Phil Henderson's elegant PacForms browser-based solution
for creating and displaying message with a compact representation for
packet radio transmission of the entered data, *pack-it-forms* is a
respectful re-implementation with a number of advantages:

1. All processing is done in-browser in Javascript: No external
   program is required for parsing the message data.

2. Message encoding is derived from form markup: The field names used
   in the message text are derived from the `name` attribute of the
   input elements of the HTML form.  There is no code specific to any
   field in a form.

3. Forms are written in a declarative style: validation constraints
   and default contents are specified in the HTML description of the
   form rather than Javascript.  A template substitution system
   enables dynamic generation of default values.

4. Reuseable form behavior: The implementation of form behavior has
   been cleanly separated and made more generic so new forms can be
   easily created.  A file inclusion mechanism allows reuse of
   sub-parts of forms as well.

5. The full implementation is available to all for study and
   enhancement.


Using Forms
===========

Installation
------------

Basic installation of pack-it-forms quite simple, simply unpack the
downloaded archive in an appropriate directory.

If you'll be using pack-it-forms with OutPost a few more installation
steps are required.  For now, this is a somewhat complex and manual
installation until proper integration with OutPost and PacFORMS can be
worked out.  Once it is complete you can create and view both PacFORMs
and pack-it-forms based forms.

To allow Outpost to open messages formatted by pack-it-forms, we make
a copy of the PacFORMS pac-read.exe program and replace it with a
wrapper program that knows how to open pack-it-forms forms and call
the original pac-read.exe for PacFORMS forms:

1. Download and extract the install archive of pack-it-forms for
   windows.  Recent zip archives are hosted at:

     http://www.picnicpark.org/keith/ham-radio/pack-it-forms/

   Unless you have a good reason to get an old version, select the
   most recent version, typically the last in the list.  The zip file
   contains a single directory called `pack-it-forms` with all
   required files.  It is recommended that you unpack the zip file in
   the root of the `C:\` drive so that the files will all be in
   `C:\pack-it-forms`.
2. If you have never installed pack-it-forms before, set the
   environment variable PACKITFORMS_BASE to the directory where you
   extracted pack-it-forms.  It is preferable to use a "User" variable
   instead of a "System" variable as generally multiple users should
   not use the same pack-it-forms directory.  If you are updating an
   existing installation and unpacking the files on top of the former
   location, this step can be skipped.
3. If you have never installed pack-it-forms before, copy the file:
   `C:\PacFORMS\exec\pac-read.exe` to
   `C:\PacFORMS\exec\pac-read-pacforms.exe`.  If you are updating an
   existing installation, this step isn't required unless PacFORMS has
   also been updated, overwriting the previously installed
   pack-it-forms version of `pac-read.exe`.  To determine whether this
   is the case, issue the command `C:\PacFORMS\exec\pac-read.exe` in a
   Windows Command Prompt shell.  If the first line of output in the
   shell window starts with "Traceback", then you should *not* copy
   `pac-read.exe` to `pac-read-pacforms.exe`, otherwise go ahead and
   make a copy.
4. Copy all the contents of the following directory
   `<pack-it-forms>\resources\scripts\pac-read\build\exe.win32-3.4` to
   the directory `C:\PacFORMS\exec`.  This will overwrite the
   `pac-read.exe` file that currently exists in that directory,
   replacing either the PacFORMS version or the earlier pack-it-forms
   version.  This new executable is a "frozen" python script (made
   with cx_Freeze) that requires support files in the same directory.
   The rest of the copied files are these support files.  None of them
   should overwrite any existing PacFORMS file.
5. Finally, for the replacement `pac-read.exe` program to work
   correctly you need to have `MSVCR100.dll` installed. This may be
   missing from the computer.  To determine if you need to install
   this DLL, open a Windows Command Prompt, change to the
   `C:\PacFORMS\exec` directory and run the command `pac-read.exe`.
   If you get a traceback everything is fine.  If you get a pop-up
   window saying MSVCR100.dll is missing you need to install the
   32-bit Microsoft Visual C++ Redistributable Package.  Follow the
   instructions at the following URL to download and install the
   required package:
   `http://www.microsoft.com/en-gb/download/details.aspx?id=5555`.

The PacFORMS installer is not aware of pack-it-forms, so these steps
will likely be required every time PacFORMS is updated.

If you have never installed pack-it-forms before or Outpost has been
updated since it was last installed, you can enable creation of
pack-it-forms forms using Outpost's Form menu with the following
steps:

1. Locate the file launch.ini in the Outpost data directory.
2. Add an appropriately formatted line for each pack-it-form form you
   would like to create.  The format is the same as for pack-it-forms
   but with the filename for the pack-it-forms form substituted.

The Outpost installer is not yet aware of pack-it-forms, so these
steps will likely be required every time Outpost is updated.

All the above steps can be reversed to remove pack-it-forms from your
Outpost and PacFORMS installation.

Entering Data in a New Form
---------------------------

To enter data in a new form, open the HTML file for the form in your
web browser.  You can do this through appropriate menu entries in
OutPost if you setup Outpost.  Otherwise you can use your normal
operating system file browser or command line to open the file.  It
may take a moment to load and will display a spinner to show activity
is occurring if it takes longer than a second.

Once loaded you will see a typical browser form.  Across the top of
the page is a header bar with two buttons:

   1. Submit to OutPost
   2. Show Data Message

The `Submit to OutPost` button will submit the form data to OutPost to
transmit as a packet radio message.  It is disabled until the form is
valid, with all required fields entered with acceptable values.  The
validity of the form as a whole is also indicated by the color of the
header bar.  When the entire form is valid the bar will turn from gray
to green.  Any field that is invalid either because no data has been
entered or because the entered data is not acceptable is highlighted
with a reddish glow.  Depending on the browser, hovering the cursor
over the field may give additional information about why the field is
considered invalid.

The `Show Data Message` button will open an overlay with the current
contents of the data message that would be transmitted to OutPost if
the `Submit to OutPost` button were pressed.  The underlying form is
still active and the overlay will update in real-time as data is
entered in form controls.  The overlay is read-only so you can not
type into it but you can select text and copy it using the clipboard.
Click the button again to hide the overlay.

When the form is first loaded the cursor will be positioned at the
first invalid field in form since this is typically the first field
you'll want to enter.  You can navigate between fields as usual using
the mouse pointer and standard keyboard shortcuts.

Some form fields may be disabled with contents that looks like one or
more words surrounded by curly braces.  For example `"{{date}}"`.  These
are placeholders that indicate values that will be automatically
substituted when the form is submitted.  If you show the data message
content you will see that the placeholders are replaced in this output
and continuously as you change the form.  In this way the data message
text always matches what you'd expect to see in OutPost.


Viewing Previously Entered Forms
--------------------------------

If you have setup OutPost integration opening the message in OutPost
should result in a new browser window containing the filled out
message form.  Since you are viewing the contents of a previously sent
message the form controls are all read-only so that the data is not
accidentally modified.  The button bar has a blue color to give
another visible clue that the form is being viewed rather than being
created.  The browser tab or window can be closed when viewing of the
message is complete.

To manually view a previously entered form you must supply some
additional data to the form through query parameters in the browser
URL.  There are two query parameters that matter, `msgno` and `mode`.

The `msgno` query parameter is used to refer to the data that is to be
viewed.  There must be a file in the `msgs` subdirectory of the
installation with the name as the `msgno` parameter value.  The form
will load the data to be viewed from this file.

The `mode` parameter specifies the viewing mode.  Currently, if it is
not present the form will be editable and if it is present any value
can be specified.  If the value specified is `readonly` then the
presentation mode will switch to the read-only view as described for
the OutPost method of viewing messages above.



Creating New Forms
==================

Forms for *pack-it-forms* are just normal HTML forms with some
restrictions to allow the form to work smoothly with the Javscript
code that implements pack-it-forms functionality.  The simplest way to
get started creating a new form is to copy an existing form and
replace the content of the `form` element with the id `the-form`.
With the exception of the `title` element in the document head, the
rest of the HTML in the form outside this element is boilerplate
required for the pack-it-forms Javascript and CSS to be able to
display and process the forms correctly with the features described
above.

In general, it shouldn't be necessary to create new forms completely
from scratch, but should you wish to try to do so, the _Explanation of
the Form Boilerplate_ section below describes the purpose of the
various boilerplate sections.

Assuming you start with all the boilerplate in place, here are the
steps you should follow in creating your form:

   1. Change the `title` element in the document head
   2. Add input elements to the form
   3. Setup default and on-submit behavior on fields
   4. Adjust layout and styling

The next sections cover each of these in detail.


Change the Title Element in the Document Head
---------------------------------------------

You should change the value of the `title` element to be the name of
your new form; this will automatically be used both for the page title
and for the form name header in the upper left hand side of the form.

Add Input Elements to the Form
------------------------------

To add fields to your form, you just need to add standard html `input`
and `textarea` elements --- just like any other HTML form.  However,
the input elements must contain a `name` attribute formatted like
this:

   * If the element maps to a number in the form that you are trying
     to replicate, like `10`, then the value should be that number
     followed by a period followed by a short description.  Example:
     `10.subject`.  This means that the number will be used as the
     reference to the information in the PacFORMS output
   * Otherwise, just use a short, descriptive name like `Method`.
     Since the field name won't start with a number, this means that
     the whole text of the field name will be used as the reference in
     the PacFORMS output.

While you can use different methods for adding descriptions to
inputs, here are a few ways that generally work well with the default CSS:

   * If the control is a single control, it is a good idea to wrap it
     in a `label` element, with the text for the description
     preceding the actual `input` element.
   * If you are using something like a set of radio buttons that
     need to be grouped together, use the same scheme for each element
     but wrap them in a `fieldset` element with a `legend` element
     including the description for the entire set.
   * If the field is for a certain number of the form, putting a
     `<span class="field-number">` that contains the number inside the
     label will make a small superscript number appear in the label at
     its position, similar to the way that field numbers are conveyed
     in the paper version of an ICS form.

If your form fits the ICS standards, you will need a large number of
fields that contain information about the way that the form was
transmitted and who it is going to/who it is from.  *pack-it-forms*
makes this easy to do: it is possible to include fragments of HTML
from files in the resources/html directory.  If you create a `div`
element that has a `data-include-html` attribute in it, the element
will be replaced with the contents of the first `div` element in the
file resources/html/<attribute value>.html where <attribute value>
signifies the value of the `data-include-html` attribute.

One thing that you may want to do with included HTML files is set the
default values of included elements.  You can do that by putting a
JSON object that maps form field names to default values for those
fields inside the <div> that will be replaced with the included
content.  The values are in the same format as the PacFORMS field
values:  a checkbox should have a value of CHECKED if it should be
checked, and a collection of radiobuttons should have a value that
matches one of the `name` attributes.  Text fields can be set to a
template, which will be expanded (see the next section).

Setup Default and On-submit Behavior on Fields
----------------------------------------------

Default field values can be specified using the normal HTML form
mechanisms.  For text fields, however, there a template system
provides additional flexibility in establishing the defaults.

Template expansion will be performed on the `value` attribute of all
input elements with a `type` attribute value of "text" when the
document is loaded.  This will establish default values for form
fields that the user can later edit.

The one exception to the expansion when the document is loaded is
those elements with the class `init-on-submit`.  These are intended to
be automatically filled out at the time the form is submitted.  When
the form is initially displayed the template value will be shown in
the field to provide an indication that something will be filled in
later.  Since these fields aren't usually intended to be edited by the
user they usually have their `disabled` attribute set to "true".

Regular text in templates is copied from the template to the resulting
string.  The difference comes when placeholder values that are
surrounded by double curly braces are encountered.  To give an
example, on January 1st, 2020, the template:

        The date is: {{date}}.

will result in the output text:

        The date is 01/20/2020.

This is the simplest possible template value, with just the name of
the template to use.  Some template types require additional
information, in which case it can be supplied after the template name,
separated by a colon.  For example, if the query string of the
document contains a `msgno` parameter with the value `ABC001`, then:

        The msgno is {{query-string:msgno}}.

will result in the output text:

        The msgno is ABC001.

Finally, the output of template expansion can be further modified by
filters.  Filters are separated from the template type by a vertical
bar character.  Filters can also take an argument separated by a
colon.  Assuming again that the date is January 1st, 2020, an example
of a filter is:

        The month is: {{date|truncate:2}}

will result in the output text:

        The month is: 01

because "01" is the first two characters of the date string that would
be substituted without the filter.  Multiple filters can be chained
together one after another, each separated by a vertical bar.

The following template types are available:

| Name              | Argument   | Description                                     |
|-------------------|------------|-------------------------------------------------|
| date              | none       | Current date string in "mm/dd/yyyy" format      |
| time              | none       | Current local time string in hh:mm:ss format    |
| msgno             | none       | Message number for this message as a string     |
| selected-fields   | css-sel    | Get list of field values returned by `css-sel`  |
| field             | field name | Value of a field in the form                    |
| msg-field         | field name | Value of a field in the received message        |
| query-string      | key        | Value of query string parameter with name 'key' |
| envelope          | field name | Value of !OUTPOST! envelope field               |
| div-id            | id value   | Text content of the named `div` element         |
| filename          | none       | Filename of the form (final name in URI path)   |
| title             | none       | Title of the HTML document                      |
| {                 | none       | Insert a single '{' character                   |

The difference between `field` and `msg-field` is subtle but
important.  The `field` type retrieves the value of the form field
with the given name.  If the field exists in the form it will always
get the current contents of that form element in the DOM.  The
`msg-field` type retrieves the value of a form field that was sent in
a received message.  When creating a new form, all msg-field fields
will have a value that is the empty string.  This distinction is
important because some form fields have different values in the sender
and receiver version of the form.

The following filters are available:

| Name       | Argument  | Description                                        |
|------------|-----------|----------------------------------------------------|
| truncate   | length    | Truncate string to max of `length` characters      |
| split      | fld delim | Split into list by `fld delim` string              |
| join       | separator | Join list with `separator` between elements        |
| remove     | value     | Remove elements matching `value` from list         |
| sort       | type      | Sort list, if `type` is 'num', numeric, else text  |
| re_search  | regexp    | Match regexp match, returning text or capture list |
| nth        | index     | Return the nth list item or character              |
| trim       | none      | Remove whitespace at start and end of string       |
| msgno2name | msgno     | Expand message number to station                   |
| expandtmpl | none      | Apply another layer of template expansion          |

You might also want to add some amount of validation to your custom
form fields.  *pack-it-forms* uses normal HTML5 form validation for
validating fields:  the default CSS provides a visual indication of
which fields are invalid, and the top bar changes color depending on
whether or not the form is fully valid.  Here are a few tips to get
you started with HTML5 form validation of this type:

   * If you have a field that must have some input in it, add the
     attribute `required="true"`
   * If the contents of the field has to be in a certain format, add a
     `pattern` attribute: the value should be a regular expression
     that will match values of the desired format.

Adjust Layout and Styling
-------------------------

Forms written using the above guidelines should be styled to look like
paper forms, and to have a fairly responsive layout that will work
with a large variety of screen sizes.  However, if your form requires
some specific styling, create the file resources/css/<form name>.css
and put any form-specific styling in it.

Explanation of the Form Boilerplate
-----------------------------------

If you wish to create a form completely from scratch this section
describes the boilerplate in the standard forms and how it interacts
with the pack-it-forms Javascript and CSS.  With this information you
can make choices about how much of this functionality you'd like to
support in your form.

To do this we'll walk through the ICS213 form file and comment on each
section.

    <!DOCTYPE html>
    <html>
      <head>
        <meta http-equiv="Content-type" content="text/html;charset=UTF-8">

Standard HTML5 document start specifying a UTF-8 encoding.

        <link rel="stylesheet" type="text/css" href="resources/css/loading.css"/>

CSS that works with the div element with id "loading" that will be
encountered shortly, to hide the rest of the form as all the form
structure and contents are loaded.

        <link rel="stylesheet" type="text/css" href="resources/css/pack-it-forms.css"/>

CSS file that contains styles for the form interaction elements and
that are likely to be useful in more than one form.  This is highly
recommended.

        <script type="text/javascript" src="resources/js/pack-it-forms.js"></script>

Javascript file that contains the Javascript code to implement the
form behavior.  This is required to have a functioning form.

        <title>ICS213: Message Form</title>
      </head>

      <body>

Completion of the normal HTML5 head section and start of the body
section.  An appropriate title should be specified for each form.

        <div id="loading"><div>Loading<div id="spin"><div id="spin_1" class="spin"></div></div></div></div>

Nested markup required to enable the animated loading progress bar
without requiring any external graphics.

        <form id="the-form" name="the-form">
           ...
        </form>

The actual from itself replaces the ellipses here.  The Javascript
requires that the id of the form have the value "the-form".

        <div data-include-html="outpost_message_header"></div>

An include reference that is replaced with data used to format the
outpost message header.  This is required for the Javascript to work
properly.  It should come after the form.

        <div data-include-html="submit-buttons"></div>

An include reference that is replaced with the submit buttons and
related markup.  This is required for the Javascript to work
correctly.  It should come after the form.

      </body>
    </html>

Standard HTML5 body and document close.
