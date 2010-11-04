var util = require('util')
var net = require('net')
var events = require('events')

function Server(name) {
	net.Server.call(this)
	this.name = name
	var connections = {}
	var connections_by_nick = {}
	var channels = {}

	this.on('connection', function(s) { new Connection(s, this) })
	this.register = function(user, connection) {
		if(connections_by_nick[user.nick]) return false
		if(connections[user.full]) return false
		connections[user.full] = connection
		connections_by_nick[user.nick] = connection
		this.emit('register', user, connection)
		return true
	}
	this.join = function(c, u) {
		if(!channels[c]) channels[c] = new Channel(c);
		if(channels[c].users[u.nick] == u) {
			sendTo(u.full, {command: '443', params: [u.nick, c, 'is already on channel']})
		} else {
			channels[c].users[u.nick] = u
			for(var user in channels[c].users) {
				console.log(user)
				console.log(channels[c].users[user])
				this.send(channels[c].users[user].socket, 'JOIN', c)

			}
		}
	}
	this.on('message', function(m) { 
		console.log("S: ", util.inspect(m))
		this.emit(m.command, m)
	})
	this.on('PING', function(m) {
		if(m.params[0] == name) {
			sendTo(m.sender, {command: 'PONG', params: m.params})
		} else {
			// pass it on or say it's not found
		}
	})
	this.on('PRIVMSG', function(m) {
		route(m.params[0], m)
	})

	function sendTo(dest, message) {
		if(!message.sender) message.sender = name
		var l
		connections[dest].send(l = ':' +message.sender + ' ' + message.command + ' ' + message.params.join(' '))
		console.log("S> " + l)
	}

	function route(dest, message) {
		if(!message.sender) message.sender = name
		var l
		var target
		if(dest.charAt(0) == '#' || dest.charAt(0) == '&') {
			target = channels[dest]
		} else {
			target = connections_by_nick[dest]
		}
		if(!target) {
			console.log('no such destination: ' + dest)
		} else {
			target.send(l = ':' +message.sender + ' ' + message.command + ' ' + serializeParams(message))
			console.log("S> " + l)
		}
	}
}
util.inherits(Server, net.Server)

function serializeParams(message) {
	if(!message.params || message.params.length == 0) return ''
	if(message.params[message.params.length - 1].indexOf(' ') != -1) {
		return message.params.slice(0, -1).join(' ') + ' :' +message.params[message.params.length - 1]
	} else {
		return message.params.join(' ')
	}
}

Server.prototype.send = function(socket, line) {
	console.log('>> :'+this.name+' '+line)
	socket.write(':'+this.name+' '+line+"\r\n")
}

function checkOrigin(message, user) {
	if(!user && !message.sender) return true;
	if(!message.sender) message.sender = user.full
	return message.sender == user.full
}

function Connection(socket, server) {
	var self = this
	socket.on('data', lineBuffer(function(l) { self.emit('line', l) }))
	this.on('line', handleLine)
	var nick, user
	user = new User()

	function completeRegistration() {
		server.register(user, self)
		sendWelcome(server, socket, user)
		self.on('message', function(message) {
			if(checkOrigin(message, user)) {
				server.emit('message', message)
			} else { 
				console.log('Message with wrong origin: '+message.sender +' should be '+user.full+'. Dropped.')
			}
			
		});
	}
	this.on('NICK', function NICK(message) {
		console.log('NICK', util.inspect(arguments))
		if(!message.params.length) {
			server.send(socket, Codes.ERR_NONICKNAMEGIVEN+ ' No nickname given')
			//this.on('NICK', NICK) // Rearm on error // 0.3.0
			return
		}
		this.removeListener('NICK', NICK) // 0.2.x
		// Check for nickname collision; if so, send ERR_NICKNAMEINUSE
		// Check for bad nickname; if so, send ERR_ERRONEOUSNICKNAME
		// SERVER: check for nick collision, if so, send ERR_NICKCOLLISION
		// MAYBE: check for restricted nicknames, send ERR_RESTRICTED if so
		// MAYBE: check for recently used nicks; if so, send ERR_UNAVAILRESOURCE
		user.nick = message.params[0]
		if(user.complete) completeRegistration()
	})
	this.on('USER', function USER(message) {
		console.log('USER', util.inspect(arguments))
		if(message.params.length < 4) {
			server.send(socket, Codes.ERR_NEEDMOREPARAMS+' Need more parameters')
			//this.once('USER', USER) // Rearm on error
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
		server.send(socket, Codes.RPL_UMODEIS+' '+user.nick+' '+'i')
	})
	this.on('JOIN', function JOIN(message) {
		var channels = message.params[0].split(',')
		if(message.params[1]) {
			var keys = message.params[1].split(',')
		} else {
			var keys = []
		}
		for(var n in channels) {
			server.join(channels[n], user, keys[n])
		}
	})
	this.on('UNKNOWN', function UNKNOWN(cmd, params, sender) {
		console.log('Unknown command: '+cmd)
		socket.write(':'+server.name+' NOTICE Auth :This server is not finished yet.\r\n')
		socket.write(':'+server.name+' ERROR :Closing link\r\n')
		socket.end()
	})

	this.send = function(line) {
		socket.write(line + '\r\n')
	}
}

util.inherits(Connection, events.EventEmitter)

function Channel(name) {
	this.name = name
	this.users = {}
	this.topic = ''
}
util.inherits(Channel, events.EventEmitter)

Channel.prototype.send = function(message) {
	for(var u in this.users) {
		this.users[u].send(message)
	}
}

function User(username, mode, unused, realname, hostname) {
	var nick
	var full
	function refreshFull() {
		full = nick + '!' + username +'@' + hostname;
	}
	refreshFull()
	Object.defineProperty(this, 'full', {
		get: function() { return full }, 
		enumerable: true
	})
	Object.defineProperty(this, 'username', {
		get: function() { return username }, 
		set: function(u) { username = u; refreshFull() },
		enumerable: true
	})
	Object.defineProperty(this, 'mode', {
		get: function() { return mode },
		set: function(m) { mode = m },
		enumerable: true
	})
	Object.defineProperty(this, 'realname', {
		get: function() { return realname },
		set: function(n) { realname = n; refreshFull() },
		enumerable: true
	})
	Object.defineProperty(this, 'hostname', {
		get: function() { return hostname },
		set: function(h) { hostname = h; refreshFull() },
		enumerable: true
	})
	Object.defineProperty(this, 'nick', {
		get: function() { return nick },
		set: function(n) { nick = n; refreshFull() },
		enumerable: true
	})
	Object.defineProperty(this, 'complete', {
		get: function() { return nick && hostname && username },
		enumerable: true
	})
}

User.prototype = {}
User.prototype.full = function() {
	return this.nick + '!' + this.username + '@' + this.hostname
}

function sendWelcome(server, socket, user) {
	server.send(socket, Codes.RPL_WELCOME+' '+user.nick+' :Welcome to IRC, '+user.nick+'!'+user.username+'@'+user.hostname)
	server.send(socket, Codes.RPL_YOURHOST+' '+user.nick+' :Your host is '+server.name)
	server.send(socket, Codes.RPL_CREATED+' '+user.nick+' :This server was created juuuust for you.')
	server.send(socket, Codes.RPL_MYINFO+' '+user.nick+' '+server.name+' ircmuc iw o')
}

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
	console.log('C< ' + l)
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
	var msg = new Message(m[2].toUpperCase(), params, m[1] ? m[1] : undefined)
	this.emit(msg.command, msg)
	this.emit('message', msg)
}

function Message(command, params, sender) {
	this.command = command
	this.params = params
	if(sender) this.sender = sender
}

exports.createServer = function(name) {
	return new Server(name)
}

exports.Server = Server

var Codes = exports.Codes = {
	RPL_WELCOME: '001',
	RPL_YOURHOST: '002',
	RPL_CREATED: '003',
	RPL_MYINFO: '004',
	RPL_UMODEIS: 221,
	ERR_NOSUCHNICK: 401,
	ERR_NOSUCHSERVER: 402,
	ERR_NOSUCHCHANNEL: 403,
	ERR_CANNOTSENDTOCHAN: 404,
	ERR_TOOMANYCHANNELS: 405,
	ERR_WASNOSUCHNICK: 406,
	ERR_TOOMANYTARGETS: 407,
	ERR_NOSUCHSERVICE: 408,
	ERR_NOORIGIN: 409,
	ERR_NORECIPIENT: 411,
	ERR_NOTEXTTOSEND: 412,
	ERR_NOTOPLEVEL: 413,
	ERR_WILDTOPLEVEL: 414,
	ERR_BADMASK: 415,
	ERR_UNKNOWNCOMMAND: 421,
	ERR_NOMOTD: 422,
	ERR_NOADMININFO: 423,
	ERR_FILEERROR: 424,
	ERR_NONICKNAMEGIVEN: 431,
	ERR_ERRONEUSNICKNAME: 432,
	ERR_NICKNAMEINUSE: 433,
	ERR_NICKCOLLISION: 436,
	ERR_UNAVAILRESOURCE: 437,
	ERR_USERNOTINCHANNEL: 441,
	ERR_NOTONCHANNEL: 442,
	ERR_USERONCHANNEL: 443,
	ERR_NOLOGIN: 444,
	ERR_SUMMONDISABLED: 445,
	ERR_USERSDISABLED: 446,
	ERR_NOTREGISTERED: 451,
	ERR_NEEDMOREPARAMS: 461,
	ERR_ALREADYREGISTRED: 462,
	ERR_NOPERMFORHOST: 463,
	ERR_PASSWDMISMATCH: 464,
	ERR_YOUREBANNEDCREEP: 465,
	ERR_YOUWILLBEBANNED: 466
}
