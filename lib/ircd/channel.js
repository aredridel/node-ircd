var util = require('util')
var events = require('events')

var Message = require('./message')
var Constants = require('./constants')

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
		this.users[nick].send(Message.createMessage(user, 'JOIN', this.name))
	}
	if(this.topic) {
		user.send(Message.createMessage(user.server, Constants.RPL_TOPIC, nick, this.name, this.topic))
	} else {
		user.send(Message.createMessage(user.server, Constants.RPL_NOTOPIC, nick, this.name, "channel has no topic"))
	}
	for(var nick in this.users) {
		user.send(Message.createMessage(user.server, Constants.RPL_NAMREPLY, nick, "=", this.name, nick))
	}
	user.send(Message.createMessage(user.server, Constants.RPL_ENDOFNAMES, this.name, "End of NAMES list"))
	return true
}

Channel.prototype.part = function(user, message) {
	for(var nick in this.users) {
		if(message) {
			this.users[nick].send(Message.createMessage(user, 'PART', this.name, message))
		} else {
			this.users[nick].send(Message.createMessage(user, 'PART', this.name))
		}
	}
	this.emit('part', user, message)
	delete this.users[user.nick]
	return true
}

Channel.prototype.setTopic = function(topic, user) {
	// FIXME: check permissions
	this.topic = topic
	this.topicuser = user
	this.topictime = Math.round(new Date().getTime() / 1000)
	this.send(Message.createMessage(user, 'TOPIC', this.name, topic))
	this.emit('topic', this.topic, user)
}

Channel.prototype.quit = function(user, message) {
	delete this.users[user.nick]
	this.send(message)
}

Channel.prototype.error = function(user, message) {
	delete this.users[user.nick]
	this.send(message)
}

Channel.prototype.toString = function() {
	return this.name + " (Users[" + Object.keys(this.users).length +"]: " + Object.keys(this.users).join(', ')+")"
}


module.exports = Channel
