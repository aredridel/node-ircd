var util = require('util')
var net = require('net')
var events = require('events')

var Connection = require('./connection')
var Message = require('./message')
var Constants = require('./constants')
var Channel = require('./channel')

function sendWelcome(server, user) {
	user.send(Message.createMessage(server, Constants.RPL_WELCOME, user.nick, 'Welcome to IRC, '+user.nick+'!'+user.username+'@'+user.hostname))
	user.send(Message.createMessage(server, Constants.RPL_YOURHOST, user.nick, 'Your host is '+server.name))
	user.send(Message.createMessage(server, Constants.RPL_CREATED, user.nick, 'This server was created juuuust for you.'))
	user.send(Message.createMessage(server, Constants.RPL_MYINFO, user.nick, server.name, 'ircmuc', 'iw', 'o'))
}

function Daemon(name) {
	net.Server.call(this)
	this.name = name
	var users_by_full = {}
	var users = {}
	var channels = {}

	this.on('connection', function(s) { new Connection(s, this) })
	this.register = function(user) {
		if(users[user.nick]) {
			console.log("User " + user.nick + " is already registered")
			return false
		}
		if(users_by_full[user.id]) {
			console.log("User with ID " + user.id + " is already registered")
			return false
		}
		users_by_full[user.id] = user
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
			sendTo(m.sender, Message.createMessage(this, 'PONG', m.params))
			m.handled = true
		} else {
			// FIXME: pass it on or say it's not found
		}
	})
	this.on('PRIVMSG', function(m) {
		sendTo(m.params[0], m)
		m.handled = true
	})
	this.on('TOPIC', function(m) {
		// FIXME: route only to channels
		var chan
		if(chan = this.findChannel(m.params[0])) {
			chan.setTopic(m.params[1], m.sender)
		} else {
			m.sender.send(Message.createMessage(this, 442, m.params[0], "you're not on that channel."))
		}
		m.handled = true
	})
	this.on('QUIT', function(m) {
console.log("Quit", m)
		var c = users[m.sender.nick]
		delete users[m.sender.nick]
		delete users_by_full[m.sender.nick + '!' + m.sender.username + '@' + m.sender.hostname]
		this.emit('disconnect', c)
		m.handled = true
	})

	function sendTo(dest, message) {
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

	this.id = name
}
util.inherits(Daemon, net.Server)

module.exports = Daemon
