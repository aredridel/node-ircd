// <a href='index.html'>back to overview</a>

// Message format
// --------------

// An example message:

var message = {
	'sender': 'Nick!User@host',
	'command': 'PRIVMSG',
	'params': ['Hello, there!']
}

//	One parsed with an error:

var message = {
	'sender': 'Nick@User@Host',
	'command': 'FOO',
	'error': 'Unknown command'
}

//	Or even just:

var message = {
	'error': 'Invalid message'
}


// serializeParams(message)
// ---------------
// gives an appropriate colon-escaped IRC serialization of an array 
// of parameters
//
// Returns values such as `"foo bar :baz server"` given input like `{ params: ["foo", "bar", "baz server"] }`
//
function serializeParams(message) {
	if(!message.params || message.params.length == 0) return ''
	if(message.params[message.params.length - 1] 
		&& message.params[message.params.length - 1].indexOf(' ') != -1 
		|| message.params[message.params.length - 1] == '') {
		return message.params.slice(0, -1).concat([':' 
			+ message.params[message.params.length - 1]]).join(' ')
	} else {
		return message.params.join(' ')
	}
};


// createMessage(sender, command, params)
// --------------------------------------
// creates a message object, making sure the params are in the proper format.
//
exports.createMessage = function createMessage(sender, command, params) {
	message = {}
	if(sender) message.sender = sender
	message.command = command
	var p = Array.prototype.slice.call(arguments, 2);

	if(typeof p[0] != 'string') {
		message.params = p[0]
	} else {
		message.params = p
	}

	return message
}

// serializeMessage(message)
// -------------------------
// serializes a message into IRC `":sender COMMAND params :longparams"` form.
//
exports.serializeMessage = function serializeMessage(message) {
	var o = []
	if(message.sender) {
		if(message.sender.id) {
			o.push(':'+message.sender.id)
		} else {
			o.push(':'+message.sender)
		}
	}
	o.push(message.command)
	if(message.params && message.params.length) o.push(serializeParams(message))
	return o.join(' ')
}

// parseMessage(line)
// ------------------
// parses an IRC `":sender COMMAND params :longparams"` line into a 
// plain message object.
//
// Parse errors are annotated into the `error` property on the object.
//
exports.parseMessage = function parseMessage(line) {
	message = {}
	m = /(:[^ ]+ )?([A-Z0-9]+)(?: (.*))?/i.exec(line)
	if(!m) {
		message.error = 'Unable to parse message'
	} else {
		var i
		var params
		if(m[3] && (i = m[3].indexOf(':')) != -1) {
			var rest = m[3].slice(i + 1)
			message.params = m[3].slice(0, i - 1).split(' ')
			message.params.push(rest)
		} else {
			if(m[3]) {
				message.params = m[3].split(' ')
			} else {
				message.params = []
			}
		}

		if(m[2]) message.command = m[2].toUpperCase()
		if(m[1]) message.sender = m[1]

	}
	return message
}
