var xmpp = require('node-xmpp')
var MUC = require('xmpp-muc')
var irc = require('irc')

var MY_JID = 'test.0x42.net'

var r = new xmpp.Router(5299)
var muc = MUC.createMUCService(r)
r.register(MY_JID, muc.handler)

var ircd = irc.createDaemon('test.0x42.net')

ircd.listen('6668')

muc.on('channel', function(channel) {
	channel.on('join', function(user) {
		console.log("MUC", channel, "got", user)
	})
	channel.on('part', function(user, message) {
		console.log("MUC", channel, "lost", user)
	})
})

ircd.on('channel', function(channel) {
	console.log("IRC ", channel)
	channel.on('join', function(user) {
		console.log("IRC", channel, "got", user)
	})
	channel.on('part', function(user, message) {
		console.log("IRC", channel, "lost", user)
	})
})

process.on("SIGPIPE", function() { })
