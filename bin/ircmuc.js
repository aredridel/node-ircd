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

function MUCIRCUser(username, mode, unused, realname, hostname, nick) {
	irc.User.call(this, username, mode, unused, realname, hostname, nick)
}

util.inherits(MUCIRCUser, irc.User)

MUCIRCUser.prototype.send = function send(message) {
	this.emit('message', message)
}

muc.on('channel', function(channel) {
	if(!ircChannels[channel.jid]) ircChannels[channel.jid] = ircd.getChannel('#'+channel.jid.user)
	var ircc = ircChannels[channel.jid]
	channel.on('join', function(user, nick) {
		console.log("MUC", channel, "got", user, "as", nick, "using IRC channel", ircc)
		console.log(util.inspect(user))
		if(!ircUsers[user]) ircUsers[user] = new irc.User(user.user, '', null, 'XMPP User', user.domain, ircNick(nick))
		var ircu = ircUsers[user]
		ircc.join(ircUsers[user])
		ircu.join(ircChannels[channel.jid])
		ircu.on('message', function(message) {
			if(message.command != 'PRIVMSG') return
			if(!message.params[1]) return
			console.log("MUC got ", message, "FROM IRC!")
			var s = new xmpp.Element('message', {
				from: channel.jid + '/' + message.sender.nick, 
				type: 'groupchat'})
			s.c('body').t(message.params[1])
			channel.send(s)
		})
	})
	channel.on('part', function(user, message) {
		var ircu = ircUsers[user]
		ircc.part(ircUsers[user], message)
		delete ircUsers[user]
		console.log("MUC", channel, "lost", user)
	})
})

ircd.on('channel', function(channel) {
	console.log("IRC ", channel)
	var mucc = muc.getChannel(channel.name.slice(1) +'@'+MY_JID)
	channel.on('join', function(user) {
		console.log("IRC", channel, "got", user)
		var s = new xmpp.Element('presence', {
			from: mucc.jid + '/' + user.nick})
		s.c('x', {xmlns: 'http://jabber.org/protocol/muc#user'})
		mucc.send(s)
	})
	channel.on('part', function(user, message) {
		console.log("IRC", channel, "lost", user)
		var s = new xmpp.Element('presence', {
			from: mucc.jid + '/' + user.nick, type: 'unavailable'})
		s.c('x', {xmlns: 'http://jabber.org/protocol/muc#user'})
		mucc.send(s)
	})
})

process.on("SIGPIPE", function() { })

function ircNick(str) {
	return str.replace(/[^a-zA-Z0-9\[\]\\\`\^\{\}]/, '_')
}
