'use strict';

const server = require('server');

server.post('SfccNotifyHook', server.middleware.https, function (req, res, next) {
	//

	next();
});

module.exports = server.exports();
