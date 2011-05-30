var fs = require('fs')

var sections = {
	A: {name: 'admin', fields: ['admin', 'email', 'other']},
	M: {name: 'machine', fields: ['servername', 'ip', 'geo', 'pingport']},
	P: {name: 'listeners', fields: ['addr', '_', 'mask', 'port'], multiple: true},
	Y: {name: 'classes', fields: ['name', 'pingfreq', 'connectfreq', 'max', 'sendq', 'locallimit', 'globallimit'], multiple: true},
	I: {name: 'clients', fields: ['addrmask', 'password', 'hostmask', 'port', 'class'], multiple: true},
	O: {name: 'opers', fields: ['servermask', 'password', 'username', '_port', 'class'], multiple: true, add: {global: true} },
	o: {name: 'opers', fields: ['servermask', 'password', 'username', '_port', 'class'], multiple: true, add: {global: false} },
	K: {name: 'bans', fields: ['hostmask', 'time_comment', 'auth', 'port'], multiple: true, add: {global: true} },
	k: {name: 'bans', fields: ['hostmask', 'time_comment', 'auth', 'port'], multiple: true, add: {global: false} }
}

var unsupported = {
	R: {name: 'restrict'},
	C: {name: 'connects'},
	N: {name: 'network'},
	D: {name: 'deny'},
	H: {name: 'hubs'},
	L: {name: 'leafs'},
	V: {name: 'versions'},
	Q: {name: 'quarantine'},
	S: {name: 'services'},
	B: {name: 'bounce'},
	Z: {name: 'ipban'}
}

exports.readTraditionalConfig = function readTraditionalConfig(file, callback) {
	fs.readFile(file, 'utf8', function(err, data) {
		out = {}
		if(err) return callback(err)
		var lines = data.split("\n")
		for(var lineNo in lines) {
			var line = lines[lineNo].split(":")
			lineNo = Number(lineNo)
			var lineobj = {}

			if(line[0] == '#') continue // Skip comments
			if(line.length == 0) continue // Skip blank lines
			if(line[0] == '') continue // Skip newline-only lines

			if(!sections[line[0]]) return callback("Unknown section " + line[0] + " on line " + (lineNo + 1))

			if(!sections[line[0]].multiple && out[sections[line[0].name]]) 
				return callback("Duplicate entry for " + line[0] + " section, not allowed on line " + (lineNo + 1))

			if(line.length - 1 > sections[line[0]].fields.length) return callback("Too many fields on line " + (lineNo + 1))

			for(var j = 1; j < line.length; j++) lineobj[sections[line[0]].fields[j - 1]] = line[j]

			if(sections[line[0]].add) for(var k in sections[line[0]].add) lineobj[k] = sections[line[0]].add[k]

			if(sections[line[0]].multiple) {
				if(!out[sections[line[0].name]]) out[sections[line[0]].name] = []
				out[sections[line[0]].name].push(lineobj)
			} else {
				out[sections[line[0]].name] = lineobj
			}
		}

		if(out.machine && out.machine.servername) out.name = out.machine.servername
		callback(null, out)
	})
}
