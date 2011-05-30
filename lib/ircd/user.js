var util = require('util')
var events = require('events')

var Message = require('./message')

function User(username, mode, unused, realname, hostname, nick) {
	this.username = username
	this.mode = mode
	this.realname = realname
	this.hostname = hostname
	this.nick = nick
	this.id = nick + '!' + username + '@' + hostname;
	this.channels = {}
}

util.inherits(User, events.EventEmitter)

User.prototype.complete = function() {
	return this.nick && this.hostname && this.username
}

User.prototype.send = function(message) {
	var serialized = Message.serializeMessage(message)
	console.log("IRC> " + serialized)
	this.emit(message.command, message)
	this.emit('message', message)
	try {
		if(this.socket) this.socket.write(serialized + "\r\n")
	} catch(e) {
		console.log(e)
		// FIXME: if socket is dead, disconnect this user
	}
}

User.prototype.join = function(channel) {
	this.channels[channel.name] = channel
}

User.prototype.toString = function toString() { return this.id }

module.exports = User

module.exports.createUser = function createUser(username, mode, unused, realname, hostname, nick) {
	return { username: username, mode: mode, realname: realname, hostname: hostname, nick: nick, channels: [], id: nick+'!'+username+'@'+hostname }
}
