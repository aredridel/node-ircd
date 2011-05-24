var util = require('util')
var events = require('events')

function User(username, mode, unused, realname, hostname, nick) {
	this.username = username
	this.mode = mode
	this.realname = realname
	this.hostname = hostname
	this.nick = nick
	this.channels = {}
}

util.inherits(User, events.EventEmitter)

User.prototype.IRCID = function() {
	return this.nick + '!' + this.username +'@' + this.hostname;
}

User.prototype.complete = function() {
	return this.nick && this.hostname && this.username
}

User.prototype.send = function(message) {
	console.log("IRC> " + message.toString())
	this.emit(message.command, message)
	this.emit('message', message)
	try {
		if(this.socket) this.socket.write(message.toString()+"\r\n")
	} catch(e) {
		console.log(e)
		// FIXME: if socket is dead, disconnect this user
	}
}

User.prototype.join = function(channel) {
	this.channels[channel.name] = channel
}

User.prototype.toString = User.prototype.IRCID

module.exports = User
