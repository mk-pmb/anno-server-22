
API cheatsheet
==============

Introduction
------------

Our annotation server project aims to implement, and to conform closely to,
the [Web Annotation Model](https://www.w3.org/TR/annotation-model/) and
the [Web Annotation Protocol](https://www.w3.org/TR/annotation-protocol/).

For general information on what an annotation server is,
what it can be used for, etc., please see the chapters titled "Abstract"
in both previous links.


### Quick start

The first thing you need to determine is the…


Annotation server base URL
--------------------------

In the default development scenario, the base URL is: http://localhost:33321/

To make the examples in this cheatsheet work for everyone even without
installing a local server, we'll instead use
the Heidelberg University annotation server.
The base URL for that is:
https://anno.ub.uni-heidelberg.de/

__Behavior:__ The base URL redirects to `…/static/`.


`/static/`
----------

This is traditional "dumb" webspace.
Files in here could be customized, but that's discouraged,
so probably you'll see the default page that just says
"Hello. This is an annotation server."
with a little cookie button in the bottom right.

The cookie button is there to easily set the debug cookie.
Usually you don't want a debug cookie, except when you're working on the
server code in some places, in which case you'll know from the source code
which debug options you want.



`/anno/by/subject_target<options>/<IRI>`
----------------------------------------

Lists all annotations that have this IRI as one of their targets.
Example: https://anno.ub.uni-heidelberg.de/anno/by/subject_target/https://digi.ub.uni-heidelberg.de/diglit/cpg389/0037


### Option `;limit=`

Sometimes you just want to check whether there are some annotations,
but not download potentially thousands of them. You can add option
`;limit=` + a number to limit the number of results:

https://anno.ub.uni-heidelberg.de/anno/by/subject_target;limit=5/https://digi.ub.uni-heidelberg.de/diglit/cpg389/0037

In case of a limit, the intended result is to give the latest annotations,
but as of 2025-02-05, ordering is not reliable yet.


### Pagination

… is not supported yet.


### Wildcard match

If the IRI ends with `/*`, the final asterisk acts as a wildcard,
listing all annotations that have a target whose IRI starts with
`<IRI>/`, i.e. the asterisk is omitted but the slash remains:

https://anno.ub.uni-heidelberg.de/anno/by/subject_target;limit=5/https://digi.ub.uni-heidelberg.de/diglit/cpg389/*

For scenarios where some software doesn't accept an asterisk as part of a URL,
e.g. GitHub's markdown renderer as of 2025-02-05,
you may URL-encode it as `%2A`:

https://anno.ub.uni-heidelberg.de/anno/by/subject_target;limit=5/https://digi.ub.uni-heidelberg.de/diglit/cpg389/%2A

The restriction to allow wildcards only after a slash is there to improve
performance and simplify access control rules.



### Option `;fmt=rss`

Output will be formatted as an RSS feed.
An automatic limit may be applied in addition to your `;limit=` option.

https://anno.ub.uni-heidelberg.de/anno/by/subject_target;fmt=rss;limit=20/https://digi.ub.uni-heidelberg.de/diglit/cpg389/0037



















