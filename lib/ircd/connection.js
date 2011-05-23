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
	m = /(:[^ ]+ )?([A-Z0-9]+) (.*)/i.exec(l)
	if(!m) {
		console.log('Malformed command from client: ' + l)
		return;
	}
	var i
	var params
	if((i = m[3].indexOf(':')) != -1) {
		var rest = m[3].slice(i + 1)
		params = m[3].slice(0, i - 1).split(' ')
		params.push(rest)
	} else {
		params = m[3].split(' ')
	}
	return msg = new Message(m[1] ? m[1] : undefined, m[2].toUpperCase(), params)
}

function checkOrigin(message, user) {
	if(!user && !message.sender) return true;
	if(!message.sender) message.sender = user
	return message.sender == user
}

function Connection(socket, server) {
	var self = this
	socket.on('data', lineBuffer(function(l) { self.emit('line', l) }))

	var nick, user
	user = new User()

	this.on('line', function(l) {
		var message = handleLine(l)
		if(checkOrigin(message, user)) {
			this.emit(msg.command, msg)
			this.emit('message', msg)
		} else { 
			console.log('Message with wrong origin: '+message.sender +' should be '+user.full+'. Dropped.')
		}
	})

	function completeRegistration() {
		if(!server.register(user)) {
			send(new Message(server, 'ERROR', 'Something bad happened'))
			socket.end()
		}
		self.on('message', function(message) {
			server.emit('message', message)
		})
		user.server = server
	}
	this.on('NICK', function NICK(message) {
		if(!message.params.length) {
			send(new Message(server, Constants.ERR_NONICKNAMEGIVEN, 'No nickname given'))
			return
		}
		if(server.findNick(message.params[0])) {
			send(new Message(server, Constants.ERR_NICKNAMEINUSE, message.params[0], "Nickname is already in use"))
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
		if(user.complete) completeRegistration()
	})
	this.on('USER', function USER(message) {
		if(message.params.length < 4) {
			send(new Message(server, Constants.ERR_NEEDMOREPARAMS, 'Need more parameters'))
			return
		}
		this.removeListener('USER', USER)
		user.username =  message.params[0]
		user.mode = message.params[1]
		//user.unused = message.params[2]
		user.realname =  message.params[3]
		user.hostname =  socket.remoteAddress
		user.socket = socket
		if(user.complete) completeRegistration()
	})
	this.on('MODE', function MODE(message) {
		var target = message.params[0]
		send(new Message(server, Constants.RPL_UMODEIS, user.nick, '+i'))
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
	})
	this.on('QUIT', function QUIT(message) {
		for(var c in user.channels) {
			user.channels[c].quit(user, message)
		}
		socket.on('error', function(e) {
			console.log(e + " disconnecting user " + user.full)
		})
		send(new Message(server, 'ERROR', "Have a great day!"))
		socket.end()
	})
	this.on('PART', function PART(message) {
		var channels = message.params[0].split(',')
		for(var n in channels) {
			if(user.channels[channels[n]]) {
				user.channels[channels[n]].part(message.sender, message.params[1])
			} else {
				send(new Message(server, Constants.ERR_NOTONCHANNEL, channels[n], "you're not on that channel!"))
			}
		}
	})
	this.on('error', function error(e) {
		message = new Message(user, 'ERROR', e.message)
		for(var c in user.channels) {
			user.channels[c].error(user, message)
		}
		send(message)
		socket.end()
	})
	function send(message) {
		console.log("IRC> " + message.toString())
		try {
			socket.write(message.toString() + "\r\n")
		} catch(e) {
			this.emit('error', e)
		}
	}
}

util.inherits(Connection, events.EventEmitter)

module.exports = Connection
