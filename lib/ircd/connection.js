var util = require('util')
var net = require('net')
var events = require('events')

var User = require('ircd/user')
var Message = require('ircd/message')
var Constants = require('ircd/constants')

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

function handleLine(l) {
	console.log('IRC< ' + l)

	m = Message.parseMessage(l)

	if(m.error) {
		console.log('Malformed command from client: ' + l + ' with error message ' + m.error)
		return
	}

	return m
}

function checkOrigin(message, user) {
	if(!user && !message.sender) return true;
	if(!message.sender) message.sender = user
	return message.sender == user
}

function Connection(socket, server) {
	socket.on('data', lineBuffer(function(l) { this.emit('line', l) }.bind(this)))
	//this.type = 

	var nick
	var user = new User()
	//var handler = pre

	this.on('line', function(l) {
		try {
			var message = handleLine(l)
			if(!message) return;
			if(checkOrigin(message, user)) {
				this.emit(message.command, message)
				this.emit('message', message)
				if(!message.handled) send(Message.createMessage(server.id, Constants.ERR_UNKNOWNCOMMAND, [user.nick, message.command, 'Unknown command']))
			} else { 
				console.log('Message with wrong origin: '+message.sender +' should be '+user.full+'. Dropped.')
			}
		} catch(e) {
			this.emit('error', e)
			console.log("ERROR: "+e.message+"\n\t"+e.stack.join("\n\t"))
		}
	})

	this.on('NICK', function NICK(message) {
		if(!message.params.length) {
			send(Message.createMessage(server, Constants.ERR_NONICKNAMEGIVEN, 'No nickname given'))
			return
		}
		if(server.findNick(message.params[0])) {
			send(Message.createMessage(server, Constants.ERR_NICKNAMEINUSE, message.params[0], "Nickname is already in use"))
			return;
		}
		/* 
			Check for bad nickname; if so, send ERR_ERRONEOUSNICKNAME
			SERVER: check for nick collision, if so, send ERR_NICKCOLLISION
			MAYBE: check for restricted nicknames, send ERR_RESTRICTED if so
			MAYBE: check for recently used nicks; if so, send ERR_UNAVAILRESOURCE
		*/
		this.removeListener('NICK', NICK)
		user.nick = message.params[0]
		if(user.complete()) this.completeRegistration(user, server)
	})
	this.on('USER', function USER(message) {
		if(message.params.length < 4) {
			send(Message.createMessage(server, Constants.ERR_NEEDMOREPARAMS, 'Need more parameters'))
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
	this.on('MODE', function MODE(message) {
		var target = message.params[0]
		send(Message.createMessage(server, Constants.RPL_UMODEIS, user.nick, '+i'))
		message.handled = true
	})
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
				console.log("Duplicate join to " + chan.name + " from " + user.nick + ". Ignored.")
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

	this.on('QUIT', function QUIT(message) {
		for(var c in user.channels) {
			user.channels[c].quit(user, message)
		}
		socket.on('error', function(e) {
			console.log(e + " disconnecting user " + user.full)
		})
		send(Message.createMessage(server, 'ERROR', "Have a great day!"))
		socket.end()
		message.handled = true
	})

	this.on('PART', function PART(message) {
		var channels = message.params[0].split(',')
		for(var n in channels) {
			if(user.channels[channels[n]]) {
				user.channels[channels[n]].part(message.sender, message.params[1])
			} else {
				send(Message.createMessage(server, Constants.ERR_NOTONCHANNEL, channels[n], "you're not on that channel!"))
			}
		}
		message.handled = true
	})

	this.on('error', function error(e) {
		message = Message.createMessage(user, 'ERROR', e.message)
		for(var c in user.channels) {
			user.channels[c].error(user, message)
		}
		if(socket.writable) {
			send(message)
			socket.end()
		}
	})

	var send = this.send = function send(message) {
		var serialized = Message.serializeMessage(message)
		console.log("IRC> " + serialized)
		try {
			socket.write(serialized + "\r\n")
		} catch(e) {
			this.emit('error', e)
		}
	}.bind(this)

	var completeRegistration = function completeRegistration(user, server) {
		user.id = user.nick + '!' + user.username + '@' + user.hostname
		if(!server.register(user)) {
			send(Message.createMessage(server, 'ERROR', 'Something bad happened'))
			socket.end()
		}
		this.on('message', function(message) {
			server.emit('message', message)
		})
		user.server = server
	}.bind(this)
}

util.inherits(Connection, events.EventEmitter)

module.exports = Connection
