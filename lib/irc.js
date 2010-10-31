var util = require('util')
var net = require('net')
var events = require('events')

function Server(name) {
	net.Server.call(this)
	this.name = name
	var connections = {}
	var channels = {}

	this.on('connection', function(s) { new Connection(s, this) })
	this.on('register', function(user, connection) {
		connections[user] = connection
	})
	this.on('join', function(c, u) {
		if(!channels[c]) channels[c] = new Channel(c);
		channels[c].users[u.nick] = u
		for(var user in channels[c].users) {
			this.send(channels[c].users[user].socket, 'JOIN', c)
		}
	})
}
util.inherits(Server, net.Server)

Server.prototype.send = function(socket, line) {
	console.log('>> :'+this.name+' '+line)
	socket.write(':'+this.name+' '+line+"\r\n")
}

function Connection(socket, server) {
	var self = this
	socket.on('data', lineBuffer(function(l) { self.emit('line', l) }))
	this.on('line', handleLine)
	var nick
	this.on('NICK', function NICK(params, sender) {
		console.log('NICK', util.inspect(params))
		if(!params.length) {
			server.send(socket, Codes.ERR_NONICKNAMEGIVEN+ ' No nickname given')
			return
		}
		// Check for nickname collision; if so, send ERR_NICKNAMEINUSE
		// Check for bad nickname; if so, send ERR_ERRONEOUSNICKNAME
		// SERVER: check for nick collision, if so, send ERR_NICKCOLLISION
		// MAYBE: check for restricted nicknames, send ERR_RESTRICTED if so
		// MAYBE: check for recently used nicks; if so, send ERR_UNAVAILRESOURCE
		if(this.user) {
			this.user.nick = params[0]
			server.emit('register', this.user, socket)
			sendWelcome(server, socket, this.user)
			this.registered = true
		} else {
			nick = params[0]
		}
	})
	this.on('USER', function USER(params, sender) {
		console.log('USER', util.inspect(params))
		if(params.length < 4) {
			server.send(socket, Codes.ERR_NEEDMOREPARAMS+' Need more parameters')
			return
		}
		this.user = new User(params[0], params[1], params[2], params[3], socket.remoteAddress)
		this.user.socket = socket
		if(nick) {
			this.user.nick = nick
			server.emit('register', this.user, socket)
			sendWelcome(server, socket, this.user)
			this.registered = true
		}
	})
	this.on('MODE', function MODE(params, sender) {
		var target = params.shift
		server.send(socket, Codes.RPL_UMODEIS+' '+this.user.nick+' '+'i')
	})
	this.on('PING', function PING(params, sender) {
		server.send(socket, 'PONG '+this.user.nick)
	})
	this.on('JOIN', function JOIN(params, sender) {
		var channels = params[0].split(',')
		if(params[1]) {
			var keys = params[1].split(',')
		} else {
			var keys = []
		}
		for(var n in channels) {
			server.emit('join', channels[n], this.user, keys[n])
		}
	})
	this.on('UNKNOWN', function UNKNOWN(cmd, params, sender) {
		console.log('Unknown command: '+cmd)
		socket.write(':'+server.name+' NOTICE Auth :This server is not finished yet.\r\n')
		socket.write(':'+server.name+' ERROR :Closing link\r\n')
		socket.end()
	})
}

util.inherits(Connection, events.EventEmitter)

function Channel(name) {
	this.name = name
	this.users = {}
	this.topic = ''
}
util.inherits(Channel, events.EventEmitter)

function User(username, mode, unused, realname, hostname) {
	this.username = username
	this.mode = mode
	this.realname = realname
	this.hostname = hostname
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
	console.log('<< ' + l)
	m = /(:[^ ]+ )?([A-Z0-9]+) (.*)/.exec(l)
	var i
	var params
	if((i = m[3].indexOf(':')) != -1) {
		var rest = m[3].slice(i + 1)
		params = m[3].slice(0, i - 1).split(' ')
		params.push(rest)
	} else {
		params = m[3].split(' ')
	}
	if(this.listeners(m[2]).length) {
		this.emit(m[2], params, m[1])
	} else {
		this.emit('UNKNOWN', m[2], params, m[1])
	}
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
