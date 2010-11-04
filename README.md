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
