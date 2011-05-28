function Message(sender, command) {
	if(sender) this.sender = sender
	this.command = command
	var p = Array.prototype.slice.call(arguments, 2);

	if(typeof p[0] != 'string') {
		this.params = p[0]
	} else {
		this.params = p
	}
}

Message.prototype.toString = function() {
	var o = []
	if(this.sender) {
		if(this.sender.IRCID) {
			o.push(':'+this.sender.IRCID())
		} else {
			o.push(':'+this.sender)
		}
	}
	o.push(this.command)
	if(this.params && this.params.length) o.push(serializeParams(this))
	return o.join(' ')
}

function serializeParams(message) {
	if(!message.params || message.params.length == 0) return ''
	if(message.params[message.params.length - 1] && message.params[message.params.length - 1].indexOf(' ') != -1 || message.params[message.params.length - 1] == '') {
		return message.params.slice(0, -1).concat([':' + message.params[message.params.length - 1]]).join(' ')
	} else {
		return message.params.join(' ')
	}
}

/*

	An example message:

	{
		'sender': 'Nick!User@host',
		'command': 'PRIVMSG',
		'params': ['Hello, there!']
	}

	One parsed with an error:

	{
		'sender': 'Nick@User@Host',
		'command': 'FOO',
		'error': 'Unknown command'
	}

	Or even just:

	{
		'error': 'Invalid message'
	}

*/


module.exports = Message

module.exports.serializeMessage = function(message) {
	var o = []
	if(message.sender) {
		if(message.sender.IRCID) {
			o.push(':'+message.sender.IRCID())
		} else {
			o.push(':'+message.sender)
		}
	}
	o.push(message.command)
	if(message.params && message.params.length) o.push(serializeParams(message))
	return o.join(' ')
}

module.exports.parseMessage = function(line) {
	message = {}
	m = /(:[^ ]+ )?([A-Z0-9]+) (.*)/i.exec(line)
	if(!m) {
		message.error = 'Unable to parse message'
	}
	var i
	var params
	if((i = m[3].indexOf(':')) != -1) {
		var rest = m[3].slice(i + 1)
		message.params = m[3].slice(0, i - 1).split(' ')
		message.params.push(rest)
	} else {
		message.params = m[3].split(' ')
	}

	message.command = m[2].toUpperCase()
	if(m[1]) message.sender = m[1]

	return message
}
