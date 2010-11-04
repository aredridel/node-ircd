* Daemon # The local, listening service
  * register()
  * join()
  * sendTo(destination, message) # send to a literal destination
  * route(destination, message) # look up an object to handle destination

* Channel # A list of users + metadata
  * send() # send to each (local)user on the channel and to each (remote)user's server

* User # A single user, and metadata
  * send() # send to user's connection

* Connection # A client or server connection
  * send() # Is this the user's socket we're representing?
  
* Server # NIY, a single (remote) server, and metadata
  * send()
