node-ircd
=========

A flexible, modular IRC daemon, trying to be very node-like in its APIs.

Motivation
----------

I run a small community chat server, and we want a hackable, fun IRCD, to do crazy new things with in the guise of IRC. So, this.

Features
--------

* Single-server for now, I and C, but not so much R.
* Events for everything, making it easy to plug new things in
* Extensible, able to add new commands
* A demo server that shows who's online and what channels exist.
* A parser for traditional ircd.conf files

Wanted Features
---------------

* Hot reloading of parts of the code
* Multiple server support
* A working demo web chat.
* Mode handling, both standard and new ideas.
* SendQ tracking, and pausing the input with the normal node `stream.pause()`
* Channel operator functions such as KICK, modes +b, +o, +k, +i and INVITE
* A LIST implementation

Overview
--------

## Socket Layer ##

* `Server`, The local, listening service
  * `register()`
  * `join()`
  * `sendTo(destination, message)`, look up an object to handle destination

* `Connection`, A client or server connection

* `Peer`, NIY, a single (remote) server, and metadata
  * send()
  
## Messaging Layer ##

* `Channel`, A list of users + metadata
  * `send()`, send to each (local)user on the channel and to each (remote)user's server

* `User`, A single user, and metadata
  * `send()`, send to user's connection

To Do
-----

* Split the message-passing functions into `User`, and leave `Connection` as parsing
* make server replies to messages use the sender object for returns
* Implement all the missing commands and replies
* Normalize nicknames and channel names for comparison.
* Make the internal API emit events that you'd want as a bot or client author: "For this user, on a message from this channel"

References
----------
* Numerics: http://www.alien.net.au/irc/irc2numerics.html
* RFC 1459: http://www.ietf.org/rfc/rfc1459.txt
* RFC 2810: http://www.ietf.org/rfc/rfc2810.txt
* RFC 2811: http://www.ietf.org/rfc/rfc2811.txt
* RFC 2812: http://www.ietf.org/rfc/rfc2812.txt
* RFC 2813: http://www.ietf.org/rfc/rfc2813.txt
* TS6: http://svn.ratbox.org/svnroot/ircd-ratbox/trunk/doc/technical/ts6.txt
