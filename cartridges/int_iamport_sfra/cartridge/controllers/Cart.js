'use strict';

const server = require('server');
server.extend(module.superModule);

server.append('Show', function (req, res, next) {
	let viewData = res.getViewData();
	let iamportRedirectError = req.querystring.error;
	let errorMessage = req.querystring.errorMessage || '';

	if (iamportRedirectError === 'true') {
		viewData.iamportRedirect = {
			error: true,
			message: errorMessage
		};
	}

	res.setViewData(viewData);
	next();
});

module.exports = server.exports();
