var util = require('util')
var net = require('net')
var events = require('events')

// <a href='channel.html'>The Channel object</a> 
var Channel = require('./ircd/channel')

// <a href='connection.html'>The Connection object</a>
var Connection = require('./ircd/connection')

// <a href='constants.html'>IRC constants</a>
var Constants = require('./ircd/constants')

// <a href='server.html'>The Server object</a>
var Server = require('./ircd/server')

// <a href='message.html'>The Message object</a>, meant to be as dumb as possible.
var Message = require('./ircd/message')

// <a href='user.html'>The User object</a>
var User = require('./ircd/user')

// <a href='util.html'>A small collection of utility functions</a>
var Util = require('./ircd/util')

// Export the main entry point for creating a server
exports.createServer = Server.createServer

// Export the various objects
exports.Channel = Channel
exports.Connection = Connection
exports.Constants = Constants
exports.Server = Server
exports.Message = Message
exports.User = User
