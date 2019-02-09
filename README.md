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

Originally there was only a single method of using pack-it-forms
involving the Outpost radio messenger application and PacFORMs, but
there are now several methods, each of which is implemented their own
repository.

The Outpost+PacFORMS method is still the currently the recommended
method, though it is hoped it will be obsolete in the near future.
Installation instructions can be found in the

[pack-it-forms outpost-pacread](https://github.com/pack-it-forms/outpost-pacread)

project. As other methods are released they will be documented here.

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

Some form fields may be disabled with content that looks like
a Javascript expression.  For example `$date()` or `$time()`.
These are placeholders that indicate values that will be automatically
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

Note that pack-it-forms is used to replicate the paper forms used in
the manual process and for ICS-213 derived forms the sender and
receiver forms have different data in a few fields such as the various
fields used for recording message numbers, the operate name/callsign,
and the date/time the message was sent/received.  Don't be surprised
by this.


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

To add fields to your form, you just need to add standard html
`input`, `select`, and `textarea` elements --- just like any other
HTML form. However, the input elements must contain a `name` attribute
formatted like this:

   * If the element maps to a number in the form that you are trying
     to replicate, like `10`, then the value should be that number
     followed by a period followed by a short description.  Example:
     `10.subject`.  This means that the number will be used as the
     reference to the information in the PacFORMS output
   * Otherwise, just use a short, descriptive name like `Method`.
     Since the field name won't start with a number, this means that
     the whole text of the field name will be used as the reference in
     the PacFORMS output.

You can give an `input` a standard style, validation pattern and placeholder
by adding one of these classes to its class attribute:

* date
* time
* phone-number
* cardinal-number
* real-number

You can override the standard style, pattern and/or placeholder with
HTML attributes, as usual.

The `select` element is used when the user should pick from a set of
known values. It isn't required, but is generally a good practice, to
use the same content for the `value` attribute of the child `option`
elements and the text that is used between the open and close tag of
that `option` element. This ensures that anyone viewing the raw message
text will see the value they expect.

Sometimes it is desirable to use a `select` elment for a pick list of
common values and allow other arbitrary values to be used as well.
This is supported by a pair of `select` and `input` elements of type
`text`. The `select` element must have one `option` child element with
a `value` attribute of "Other" and the text "Other:". The
corresponding `input` element for arbitrary values must have the same
`name` attribute as the `select` element with "-other" appened to it.
It should be set to disabled by default. An example of this in the
existing forms is the ICS Position field in the ics-header.html
resource file.

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
file resources/html/\<attribute value\>.html where \<attribute value\>
signifies the value of the `data-include-html` attribute.

One thing that you may want to do with included HTML files is set the
default values of included elements.  You can do that by putting a
JSON object that maps form field names to default values for those
fields inside the \<div\> that will be replaced with the included content.
Most default values are in the same format as HTML.
For a \<select\>, the default value should match one of the option values.
For a collection of radio buttons, the default value should match
the value of one of the buttons.

If an input element represents a field that should have different
values in a receiver's copy of a form than the senders, give the field
the class `no-msg-init` which will prevent the senders field value
(which is included in the message data) from being populated into the
field for display.  Use the template system (described in the next
section) to substitute a different value for the receiver or the
transmitter.  The `ics-header.html` and `ics-footer.html` html
fragments provide good examples of this.


Setup Default and On-submit Behavior on Fields
----------------------------------------------

Some fields have a normal value which the operator rarely edits,
and some fields have a value that cannot be edited.
These default values can be specified in HTML, as usual.
Also, a `<select>` may have a `data-default-value` attribute,
whose value matches the value of the default `<option>`.
A collection of radio buttons may have a data-default-value
attribute on any one of the buttons, whose value matches
the value of the default button.
A checkbox may have a data-default-value, in which case it will
be checked by default if and only if the data-default-value is
[truthy](https://developer.mozilla.org/en-US/docs/Glossary/Truthy).

Any of these default values may be a template.
A template begins with "$" and continues with a Javascript expression.
For example, on January 15th, 2020, the template:

        $'The date is: ' + date()

will expand to:

        The date is: 01/15/2020

A simple string that begins with "$" can be represented by a template
that begins with "$$". For example, "$$etc" represents "$etc".
The string "$" alone is not a template; it simply means "$".

Objects that are often used in templates include:

| Name                           | Description                                     |
|--------------------------------|-------------------------------------------------|
| date()                         | Current date string in "mm/dd/yyyy" format      |
| time()                         | Current local time string in hh:mm:ss format    |
| viewer                         | Either "sender" or "receiver"                   |
| envelope.readOnly              | The form should not be edit-able (boolean)      |
| envelope.sender                | Information about the sender of the message     |
| envelope.receiver              | Information about the receiver of the message   |
| envelope[viewer].ocall         | Call sign of the sender or receiver             |
| envelope[viewer].oname         | Name of the sender or receiver                  |
| envelope[viewer].ordate        | Date when the message was sent or received      |
| envelope[viewer].ortime        | Time when the message was sent or received      |
| msg_field(fieldName)           | Value of a field from the received message      |

When the form is loaded, template expansion will be performed on
the `value` property of input elements with `type="text"`,
the `innerHTML` property of \<span\> elements with a `templated` class,
and any data-default-value.
The elements must have names.
The same templates will be expanded when the form is reset.
However, templates in elements with the class `no-load-init` will
not be expanded when the form is loaded or reset.

If a form field has the class `init-on-submit`, its value is considered
a template, whose expanded value will be submitted to Outpost.
Such a field usually also has the class no-load-init, so the template will
be shown to the operator, to suggest that something will be filled in later.

You might also want to add some amount of validation to your custom
form fields.  *pack-it-forms* uses normal HTML5 form validation for
validating fields:  the default CSS provides a visual indication of
which fields are invalid, and the top bar changes color depending on
whether or not the form is fully valid.  Here are a few tips to get
you started with HTML5 form validation of this type:

   * If you have a field that must have some input in it, add the
     attribute `required`.
   * If the contents of the field has to be in a certain format, add a
     `pattern` attribute: the value should be a regular expression
     that will match values of the desired format.

Adjust Layout and Styling
-------------------------

Forms written using the above guidelines should be styled to look like
paper forms, and to have a fairly responsive layout that will work
with a large variety of screen sizes.  However, if your form requires
some specific styling, create the file resources/css/\<form name\>.css
and put any form-specific styling in it.

Link to PDF form
----------------

To link from the form to a PDF version (suitable for printing),
check the PDF into the resources/pdf folder and add a little
Javascript to the form, like this:

    ...
    <script type="text/javascript" src="resources/integration/integration.js"></script>
    <script type="text/javascript">
      link_to_PDF("resources/pdf/File_Name.pdf");
    </script>

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
        <script type="text/javascript" src="resources/integration/integration.js"></script>
 
Javascript files that contain code to implement the form's behavior.
These are required to have a functioning form.

        <title>ICS213: Message Form</title>
      </head>

      <body>

Completion of the normal HTML5 head section and start of the body
section.  An appropriate title should be specified for each form.

        <div id="loading"><div>Loading<div id="spin"><div id="spin_1" class="spin"></div></div></div></div>

Nested markup required to enable the animated loading progress bar
without requiring any external graphics.

        <div id="err">
          <div>
            <h1>Something went wrong.</h1>
            The following log information may help resolve the problem.
            <div id="error-log"></div>
          </div>
        </div>

Markup required for logging errors that occur during Javascript
execution so that they can be presented to the user appropriately.

        <form id="the-form" name="the-form">
           ...
        </form>

The actual from itself replaces the ellipses here.  The Javascript
requires that the id of the form have the value "the-form".

        <div data-include-html="submit-buttons"></div>

An include reference that is replaced with the submit buttons and
related markup.  This is required for the Javascript to work
correctly.  It should come after the form.

      </body>
    </html>

Standard HTML5 body and document close.
