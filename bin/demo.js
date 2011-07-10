#!/usr/bin/env node

var irc = require('ircd')
try {
	var express = require('express')
} catch(e) {
	console.log("You need express to run this demo. Install it with `npm install express`")
	process.exit()
}

var ircd = irc.createServer({name: 'test.0x42.net'})
var app = express.createServer()

channels = {}

app.get('/', function(req, res) {
	res.contentType("text/html")
	res.write("<ul>")
	for(var name in channels) {
		res.write("<li>")
		res.write(name)
		res.write(" - ")
		res.write(channels[name].topic)
		res.write("<ul>")
		for(var nick in channels[name].users) {
			res.write("<li>"+nick+"</li>")
		}
		res.write("</ul>")
		res.write("</li>")
	}
	res.write("</ul>")
	res.end()
})

process.on("SIGPIPE", function() { })

ircd.listen('6667')
app.listen('6680')

function attachDebug(o) {
	o.on('log.debug', function(l) {
		console.log(l)
	})
	o.on('log.notice', function(l) {
		console.log(l)
	})
	o.on('log.error', function(l) {
		console.log(l)
	})
	o.on('error', function(e) {
		console.log("ERROR: "+e.message+"\n\t"+e.stack.join("\n\t"))
	})
}

attachDebug(ircd)

ircd.on('client', function(c) {
	console.log('New connection')
	attachDebug(c)
	c.on('pingTimeout', function() {
		console.log('Disconnecting client for ping timeout')
	})
})

ircd.on('channel', function(channel) {
	channels[channel.name] = channel
	channel.on('join', function(user) {
		console.log("User " + user.nick + " joined " + channel.name)
	})
	channel.on('topic', function(topic, user) {
		console.log("Topic on channel " + channel.name + " changed to " + topic + " by " + user.nick)
	})
})
