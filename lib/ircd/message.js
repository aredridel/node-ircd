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


module.exports = Message
