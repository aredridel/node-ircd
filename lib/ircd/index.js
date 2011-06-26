var util = require('util')
var net = require('net')
var events = require('events')

// <a href='channel.html'>The Channel object</a> 
var Channel = require('./channel')

// <a href='connection.html'>The Connection object</a>
var Connection = require('./connection')

// <a href='constants.html'>IRC constants</a>
var Constants = require('./constants')

// <a href='server.html'>The Server object</a>
var Server = require('./server')

// <a href='message.html'>Message handling functions</a>
var message = require('./message')

// <a href='user.html'>The User object</a>
var User = require('./user')

// <a href='util.html'>A small collection of utility functions</a>
var Util = require('./util')

// Export the main entry point for creating a server
exports.createServer = Server.createServer

// Export the various objects
exports.Channel = Channel
exports.Connection = Connection
exports.Constants = Constants
exports.Server = Server
exports.User = User

// copy the message functions to the exports
for(var f in message) exports[f] = message[f]
