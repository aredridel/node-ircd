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

* `Server`, The local, listening service
  * `register()`
  * `join()`
  * `sendTo(destination, message)`, look up an object to handle destination

* `Channel`, A list of users + metadata
  * `send()`, send to each (local)user on the channel and to each (remote)user's server

* `User`, A single user, and metadata
  * `send()`, send to user's connection

* `Connection`, A client or server connection
  
* `Peer`, NIY, a single (remote) server, and metadata
  * send()

To Do
-----

* Reorganize `Connection` to be more prominent, making the `User` and `Channel` objects as dumb as possible.
* make server replies to messages use the sender object for returns
* Implement all the missing commands and replies
* Normalize nicknames and channel names for comparison.
* Make the internal API emit events that you'd want as a bot or client author: "For this user, on a message from this channel"
