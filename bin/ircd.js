#!/usr/bin/env node

var irc = require('ircd')

var ircd = irc.createDaemon({name: 'test.0x42.net'})

process.on("SIGPIPE", function() { })

ircd.listen('6667')

ircd.on('channel', function(channel) {
	console.log(channel)
	channel.on('join', function(user) {
		console.log("User " + user.nick + " joined " + channel.name)
	})
	channel.on('topic', function(topic, user) {
		console.log("Topic on channel " + channel.name + " changed to " + topic + " by " + user.nick)
	})
})
