pack-it-forms
=============

Inspired by Phil Henderson's elegant PacForms browser-based solution
for creating and displaying message with a compact representation for
packet radio transmission of the entered data, *pack-it-forms* is a
respectful re-implementation with a number of advantages:

1. Most processing is done in Javascript in a browser.

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

Installation instructions can be found in
[Outpost for LAARES](https://github.com/jmkristian/OutpostForLAARES).

Entering Data in a New Form
---------------------------

To enter data in a new form, click an item in Outpost's "Forms" menu.
Outpost executes the software you installed (see above),
which opens a form in your web browser.
It may take some time to load, during which it will display a spinner.
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

When viewing a previously created message, the plain text form of the
message is available in a JavaScript field named `environment.message`.
The form is initialized from this string.

The JavaScript field `environment.mode` specifies the viewing mode.
Currently, if it's
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
from files in the resources/html directory, using
[server side includes](https://en.wikipedia.org/wiki/Server_Side_Includes).

One thing that you may want to do with included HTML files is set the
default values of included elements.  You can do that by adding a
script that calls init_form_from_fields, using form field numbers as
JavaScript field names. For example:
```
<script type="text/javascript">
    init_form_from_fields({"6c.": "checked"}).
</script>
```
The values are in the same format as the PacFORMS field
values:  a checkbox should have a value of CHECKED if it should be
checked, and a collection of radiobuttons should have a value that
matches one of the `name` attributes.  Text fields can be set to a
template, which will be expanded (see the next section).

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

Default field values can be specified using the normal HTML form
mechanisms.  For text fields, however, there a template system
provides additional flexibility in establishing the defaults.

Template expansion will be performed on the `value` attribute of all
input elements with a `type` attribute value of "text" when the
document is loaded.  This will establish default values for form
fields that the user can later edit.

The one exception to the expansion when the document is loaded is
those elements with the class `no-load-init`, which prevents the
expansion.  Typically, these elements also have the class
`init-on-submit`, which indicates that template expansion should occur
at the time the form is submitted.  In this case, when the form is
initially displayed the template value will be shown in the field to
provide an indication that something will be filled in later.  Since
these fields aren't usually intended to be edited by the user they
usually have their `disabled` attribute set to "true".

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
separated by a colon.  For example, if the message number is `ABC001`, then:

        The msgno is {{environment:msgno}}.

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
| environment       | key        | Value of environment field named 'key'          |
| envelope          | field name | Value of !OUTPOST! envelope field               |
| div-id            | id value   | Text content of the named `div` element         |
| filename          | none       | Filename of the form (final name in URI path)   |
| title             | none       | Title of the HTML document                      |
| expand-while-null | templates  | Comma separated templates (\, escapes)          |
| open-brace        | none       | Insert a single '{' character                   |
| close-brace       | none       | Insert a single '}' character                   |
| open-tmpl         | none       | Insert a template open string ('{{')            |
| close-tmpl        | none       | Insert a template close string ('}}')           |

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

       <!--#include file="pack-it-forms.html" -->

HTML file that contains Javascript code to implement the form behavior.
This is required to have a functioning form.

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

        <!--#include file="resources/html/outpost_message_header.html" -->

An include reference that is replaced with data used to format the
outpost message header.  This is required for the Javascript to work
properly.  It should come after the form.

        <!--#include file="resources/html/submit-buttons.html" -->

An include reference that is replaced with the submit buttons and
related markup.  This is required for the Javascript to work
correctly.  It should come after the form.

      </body>
    </html>

Standard HTML5 body and document close.
