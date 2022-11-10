'use strict';

const server = require('server');
server.extend(module.superModule);

server.append('Show', function (req, res, next) {
	const CustomError = require('*/cartridge/errors/customError');

	let viewData = res.getViewData();
	let customError = new CustomError({ status: parseInt(req.querystring.err, 10) });

	if (req.querystring.err && (viewData.valid && !viewData.valid.error)) {
		viewData.iamportRedirect = {
			error: true,
			message: customError.message
		};
	}

	res.setViewData(viewData);
	next();
});

module.exports = server.exports();
