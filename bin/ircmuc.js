var xmpp = require('node-xmpp')
var MUC = require('xmpp-muc')
var irc = require('irc')
var util
try {
	util = require('util')
} catch(e) {
	util = require('sys')
}

var MY_JID = 'test.0x42.net'

var r = new xmpp.Router(5299)
var muc = MUC.createMUCService(r)
r.register(MY_JID, muc.handler)

var ircd = irc.createDaemon('test.0x42.net')

ircd.listen('6668')

var mucChannels = {}
var mucUsers = {}
var ircChannels = {}
var ircUsers = {}

muc.on('channel', function(channel) {
	if(!ircChannels[channel.jid]) ircChannels[channel.jid] = ircd.getChannel('#'+channel.jid.user)
	channel.on('join', function(user, nick) {
		console.log(util.inspect(user))
		if(!ircUsers[user]) ircUsers[user] = new irc.User(user.user, '', null, 'XMPP User', user.domain, ircNick(nick))
		ircChannels[channel.jid].join(ircUsers[user])
		ircUsers[user].join(ircChannels[channel.jid])
		console.log("MUC", channel, "got", user, "using IRC channel", ircChannels[channel.jid])
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

function ircNick(str) {
	return str.replace(/[^a-zA-Z0-9\[\]\\\`\^\{\}]/, '_')
}
