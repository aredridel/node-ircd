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

Wanted Features
---------------

* Hot reloading of parts of the code
* A config file reader, perhaps.
* Multiple server support
* A working demo web chat.
* Mode handling, both standard and new ideas.

Overview
--------

* Daemon, The local, listening service
  * register()
  * join()
  * route(destination, message), look up an object to handle destination

* Channel, A list of users + metadata
  * send(), send to each (local)user on the channel and to each (remote)user's server

* User, A single user, and metadata
  * send(), send to user's connection

* Connection, A client or server connection
  
* Server, NIY, a single (remote) server, and metadata
  * send()
