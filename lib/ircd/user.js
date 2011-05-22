var util = require('util')
var events = require('events')

function User(username, mode, unused, realname, hostname, nick) {
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

util.inherits(User, events.EventEmitter)

User.prototype.IRCID = function() {
	return this.full
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

User.prototype.toString = function() {
	return this.full
}

module.exports = User
