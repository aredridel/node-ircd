// <a href='index.html'>back to overview</a>

var util = require('util')
var net = require('net')
var events = require('events')

var ircd = require('./index')
var User = require('./user')
var Constants = require('./constants')

// Make a closure to buffer an incomplete line of input
function lineBuffer(callback) {
	var buffer = ''
	return function(data) {
		var i
		buffer += data
		while((i = buffer.indexOf("\n")) != -1) {
			callback(buffer.slice(0, i))
			buffer = buffer.slice(i + 1)
		}
	}
}

// Check the origin of a message for spoofing
function checkOrigin(message, user) {
	if(!user && !message.sender) return true;
	if(!message.sender) message.sender = user
	return message.sender == user
}

// The Connection object, wrapping a single client socket and 
// handling its interaction with the server.
function Connection(socket, server) {
	events.EventEmitter.call(this)

	// Helper function to handle each line and emit a `log.debug` for each
	var handleLine = function handleLine(l) {
		this.emit('log.debug', 'IRC< ' + l)

		m = ircd.parseMessage(l)

		if(m.error) {
			this.emit('log.notice', 
				'Malformed command from client: ' + l + ' with error message ' + m.error)
			return
		}

		return m
	}.bind(this)

	// Connect up the line buffer
	socket.on('data', lineBuffer(function(l) {
		this.emit('line', l)
	}.bind(this)))

	/* this.type =  */

	var nick
	var user = new User()
	/* var handler = pre */

	var pinginterval = 10000
	var pingoutstanding
	var pinger

	// Set up a periodic ping that disconnects the user if one is still 
	// outstanding when the next comes in.
	//
	// the pings need to be disabled when the socket is disconnected.
	var ping = function() {
		if(pingoutstanding) {
			this.emit('pingTimeout')
			this.disconnect(
				ircd.createMessage(server, 'QUIT', 'Ping Timeout'),
				ircd.createMessage(server, 'ERROR', 'Ping Timeout')
			)
			clearTimeout(pinger)
			pingoutstanding = false
			return
		}
		this.emit('ping')
		send(ircd.createMessage(server, 'PING', server.id))
		pingoutstanding = true
		pinger = setTimeout(ping, pinginterval)
	}.bind(this)

	// Cancel the note about the outstanding ping when the response is received
	this.on('PONG', function(message) {
		console.log('got a pong')
		message.handled = true
		/* FIXME: handle inter-server pings etc */
		pingoutstanding = false
	})

	// And actually set the ping going
	var pinger = setTimeout(ping, pinginterval)

	// This should probably be moved, so there's no log calls in the 
	// library code. FIXME.
	socket.on('error', function(e) {
		console.log(e + " disconnecting user " + user.full)
	})

	// Handle each line as it comes in
	// 
	// If nothing marks the message as handled, respond with an unknown 
	// command error
	//
	// Emits the command name with the message, then emits `message` with 
	// the message
	this.on('line', function(l) {
		try {
			var message = handleLine(l)
			if(!message) return;
			if(checkOrigin(message, user)) {
				this.emit(message.command, message)
				this.emit('message', message)
				if(!message.handled) 
					send(ircd.createMessage(server.id, Constants.ERR_UNKNOWNCOMMAND, 
						[user.nick, message.command, 'Unknown command']))
			} else { 
				this.emit('log.error',
					'Message with wrong origin: '+message.sender +' should be '+
						user.full+'. Dropped.')
			}
		} catch(e) {
			this.emit('error', e)
		}
	})

	// Handle the incoming nickname request
	//
	// FIXME: some of the error states are not checked for.
	// 
	// If the nickname completes the initial handshake, trigger the reponse.
	this.on('NICK', function NICK(message) {
		if(!message.params.length) {
			send(ircd.createMessage(server, Constants.ERR_NONICKNAMEGIVEN,
				'No nickname given'))
			return
		}
		if(server.findNick(message.params[0])) {
			send(ircd.createMessage(server, Constants.ERR_NICKNAMEINUSE,
				message.params[0], "Nickname is already in use"))
			return;
		}
		/* 
			Check for bad nickname; if so, send ERR_ERRONEOUSNICKNAME
			SERVER: check for nick collision, if so, send ERR_NICKCOLLISION
			MAYBE: check for restricted nicknames, send ERR_RESTRICTED if so
			MAYBE: check for recently used nicks; if so, send ERR_UNAVAILRESOURCE
		*/
		this.removeListener('NICK', NICK)
		message.handled = true
		user.nick = message.params[0]
		if(user.complete()) completeRegistration(user, server)
	})

	// Handle the incoming user information
	//
	// If the command completes the intitial handshake, respond.
	this.on('USER', function USER(message) {
		if(message.params.length < 4) {
			send(ircd.createMessage(server, Constants.ERR_NEEDMOREPARAMS, 
				'Need more parameters'))
			return
		}
		this.removeListener('USER', USER)
		user.username =  message.params[0]
		user.mode = message.params[1]
		//user.unused = message.params[2]
		user.realname =  message.params[3]
		user.hostname =  socket.remoteAddress
		user.socket = socket
		if(user.complete()) completeRegistration(user, server)
		message.handled = true
	})

	// Handle incoming mode change requests
	//
	// FIXME: this is totally bogus for now. This should probably be 
	// disconnected once the initial setup is done and replaced with a 
	// full handler.
	this.on('MODE', function MODE(message) {
		var target = message.params[0]
		send(ircd.createMessage(server, Constants.RPL_UMODEIS, user.nick, '+i'))
		message.handled = true
	})

	// Handle JOINing channels
	this.on('JOIN', function JOIN(message) {
		var channels = message.params[0].split(',')
		if(message.params[1]) {
			var keys = message.params[1].split(',')
		} else {
			var keys = []
		}
		for(var n in channels) {
			var chan = server.getChannel(channels[n])
			if(chan.users[user.nick] == user) {
				this.emit('log.error', 
					"Duplicate join to " + chan.name + " from " + user.nick +
						". Ignored.")
			} else {
				if(chan.join(user, keys[n])) {
					user.join(chan)
				} else {
					console.log("Error joining", chan.name, 'by', user.nick)
				}
			}
		}
		message.handled = true
	})

	// Handle QUIT, the graceful disconnect
	this.on('QUIT', function QUIT(message) {
		this.disconnect(message, 
			ircd.createMessage(server, 'ERROR', 'Have a great day!'))
		message.handled = true
	})

	// Support function shared between graceful and graceless disconnects
	this.disconnect = function disconnect(chanmessage, clientmessage) {
		if(pinger) {
			clearTimeout(pinger)
			pinger = null
		}
		for(var c in user.channels) {
			user.channels[c].quit(user, chanmessage)
		}
		send(clientmessage)
		socket.end()
	}

	// Handle parting the channel
	this.on('PART', function PART(message) {
		var channels = message.params[0].split(',')
		for(var n in channels) {
			if(user.channels[channels[n]]) {
				user.channels[channels[n]].part(message.sender, message.params[1])
			} else {
				send(ircd.createMessage(server, Constants.ERR_NOTONCHANNEL, 
					channels[n], "you're not on that channel!"))
			}
		}
		message.handled = true
	})

	// Handle exceptions by bailing just this connection rather than the 
	// whole server.
	this.on('error', function error(e) {
		message = ircd.createMessage(user, 'ERROR', e.message)
		for(var c in user.channels) {
			user.channels[c].error(user, message)
		}
		if(socket.writable) {
			send(message)
			socket.end()
		}
	})

	// Function to send a message to this connection
	// 
	// Emits a `log.debug` with the actual sent data
	var send = this.send = function send(message) {
		var serialized = ircd.serializeMessage(message)
		this.emit('log.debug', "IRC> " + serialized)
		try {
			socket.write(serialized + "\r\n")
		} catch(e) {
			this.emit('error', e)
		}
	}.bind(this)

	// Function to send the response to a completed registration
	var completeRegistration = function completeRegistration(user, server) {
		user.id = user.nick + '!' + user.username + '@' + user.hostname
		if(!server.register(user)) {
			send(ircd.createMessage(server, 'ERROR', 'Something bad happened'))
			socket.end()
		}
		this.on('message', function(message) {
			server.emit('message', message)
		})
		user.server = server
	}.bind(this)
}

// Bookkeeping
util.inherits(Connection, events.EventEmitter)

module.exports = Connection
