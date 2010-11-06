var util = require('util')
var net = require('net')
var events = require('events')

function Daemon(name) {
	net.Server.call(this)
	this.name = name
	var users_by_full = {}
	var users = {}
	var channels = {}

	this.on('connection', function(s) { new Connection(s, this) })
	this.register = function(user) {
		if(users[user.nick]) return false
		if(users_by_full[user.full]) return false
		users_by_full[user.full] = user
		users[user.nick] = user
		sendWelcome(this, user)
		this.emit('register', user)
		return true
	}
	this.findChannel = function(c) {
		return channels[c] ? channels[c] : null
	}
	this.getChannel = function(c) {
		var chan
		if(!(chan = this.findChannel(c))) {
			chan = channels[c] = new Channel(c)
			this.emit('channel', chan)
		}
		return chan
	}
	this.findNick = function(n) {
		return users[n]
	}
	this.on('message', function(m) { 
		this.emit(m.command, m)
	})
	this.on('PING', function(m) {
		if(m.params[0] == name) {
			route(m.sender, new Message(this, 'PONG', m.params))
		} else {
			// FIXME: pass it on or say it's not found
		}
	})
	this.on('PRIVMSG', function(m) {
		route(m.params[0], m)
	})
	this.on('TOPIC', function(m) {
		// FIXME: route only to channels
		var chan
		if(chan = this.findChannel(m.params[0])) {
			chan.setTopic(m.params[1], m.sender)
		} else {
			m.sender.send(new Message(this, 442, m.params[0], "you're not on that channel."))
		}
	})
	this.on('QUIT', function(m) {
		delete users[m.sender.nick]
		delete users_by_full[m.sender.full]
	})

	function route(dest, message) {
		if(!message.sender) message.sender = this
		var target
		if(dest.send) {
			target = dest
		} else if(dest.charAt(0) == '#' || dest.charAt(0) == '&') {
			target = channels[dest]
		} else if(dest.indexOf('@') != -1) {
			target = users_by_full[dest]
		} else {
			target = users[dest]
		}
		if(!target) {
			console.log('no such destination: ' + dest)
		} else {
			target.send(message)
		}
	}

	this.IRCID = function() { return name }
}
util.inherits(Daemon, net.Server)

function serializeParams(message) {
	if(!message.params || message.params.length == 0) return ''
	if(message.params[message.params.length - 1].indexOf(' ') != -1 || message.params[message.params.length - 1] == '') {
		return message.params.slice(0, -1).concat([':' + message.params[message.params.length - 1]]).join(' ')
	} else {
		return message.params.join(' ')
	}
}

Message.prototype.toString = function() {
	var o = []
	if(this.sender) {
		if(this.sender.IRCID) {
			o.push(':'+this.sender.IRCID())
		} else {
			o.push(':'+this.sender)
		}
	}
	o.push(this.command)
	if(this.params && this.params.length) o.push(serializeParams(this))
	return o.join(' ')
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
			send(new Message(server, Codes.ERR_NONICKNAMEGIVEN, 'No nickname given'))
			return
		}
		if(server.findNick(message.params[0])) {
			send(new Message(server, Codes.ERR_NICKNAMEINUSE, message.params[0], "Nickname is already in use"))
			return;
		}
		// Check for bad nickname; if so, send ERR_ERRONEOUSNICKNAME
		// SERVER: check for nick collision, if so, send ERR_NICKCOLLISION
		// MAYBE: check for restricted nicknames, send ERR_RESTRICTED if so
		// MAYBE: check for recently used nicks; if so, send ERR_UNAVAILRESOURCE
		this.removeListener('NICK', NICK)
		user.nick = message.params[0]
		if(user.complete) completeRegistration()
	})
	this.on('USER', function USER(message) {
		if(message.params.length < 4) {
			send(new Message(server, Codes.ERR_NEEDMOREPARAMS, 'Need more parameters'))
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
		send(new Message(server, Codes.RPL_UMODEIS, user.nick, '+i'))
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
				send(new Message(server, Codes.ERR_NOTONCHANNEL, channels[n], "you're not on that channel!"))
			}
		}
	})
	function send(message) {
		console.log("IRC> " + message.toString())
		socket.write(message.toString() + "\r\n")
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
		if(this.users[u] != message.sender || message.command != 'PRIVMSG') {
			this.users[u].send(message)
		}
	}
}

Channel.prototype.join = function(user) {
	this.users[user.nick] = user
	this.emit('join', user)
	for(var nick in this.users) {
		this.users[nick].send(new Message(user, 'JOIN', this.name))
	}
	user.send(this.topic ? new Message(user.server, Codes.RPL_TOPIC, this.name, this.topic) : new Message(user.server, Codes.RPL_NOTOPIC, this.name, "channel has no topic"))
	for(var nick in this.users) {
		user.send(new Message(user.server, Codes.RPL_NAMREPLY, nick, "=", this.name, nick))
	}
	user.send(new Message(user.server, Codes.RPL_ENDOFNAMES, this.name, "End of NAMES list"))
	return true
}

Channel.prototype.part = function(user, message) {
	for(var nick in this.users) {
		if(message) {
			this.users[nick].send(new Message(user, 'PART', this.name, message))
		} else {
			this.users[nick].send(new Message(user, 'PART', this.name))
		}
	}
	this.emit('part', user, message)
	delete this.users[user.nick]
	return true
}

Channel.prototype.setTopic = function(topic, user) {
	// FIXME: check permissions
	this.topic = topic
	this.send(new Message(user, 'TOPIC', this.name, topic))
	this.emit('topic', this.topic, user)
}

Channel.prototype.quit = function(user, message) {
	delete this.users[user.nick]
	this.send(message)
}

function User(username, mode, unused, realname, hostname) {
	var nick
	var full
	var channels = {}
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
	Object.defineProperty(this, 'channels', {
		get: function() { return channels },
		enumerable: true
	})
}

User.prototype = {}
User.prototype.IRCID = function() {
	return this.full
}

User.prototype.send = function(message) {
	console.log("IRC> " + message.toString())
	this.socket.write(message.toString()+"\r\n")
}

User.prototype.join = function(channel) {
	this.channels[channel.name] = channel
}

function sendWelcome(server, user) {
	user.send(new Message(server, Codes.RPL_WELCOME, user.nick, 'Welcome to IRC, '+user.nick+'!'+user.username+'@'+user.hostname))
	user.send(new Message(server, Codes.RPL_YOURHOST, user.nick, 'Your host is '+server.name))
	user.send(new Message(server, Codes.RPL_CREATED, user.nick, 'This server was created juuuust for you.'))
	user.send(new Message(server, Codes.RPL_MYINFO, user.nick, server.name, 'ircmuc', 'iw', 'o'))
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

function Message(sender, command) {
	if(sender) this.sender = sender
	this.command = command
	var p = Array.prototype.slice.call(arguments, 2);

	if(typeof p[0] != 'string') {
		this.params = p[0]
	} else {
		this.params = p
	}
}

exports.createDaemon = function(name) {
	return new Daemon(name)
}

exports.Daemon = Daemon

var Codes = exports.Codes = {
	RPL_WELCOME: '001',
	RPL_YOURHOST: '002',
	RPL_CREATED: '003',
	RPL_MYINFO: '004',
	RPL_UMODEIS: 221,
	RPL_NOTOPIC: 331,
	RPL_TOPIC: 332,
	RPL_NAMREPLY: 353,
	RPL_ENDOFNAMES: 366,
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
