'use strict';

const server = require('server');
server.extend(module.superModule);

/**
 * Checkout-Begin : The Checkout-Begin endpoint will render the checkout shipping page for both guest shopper and returning shopper
 * @extend Base/Checkout-Begin
 * @function
 * @memberof Checkout
 */
server.append('Begin', function (req, res, next) {
	let viewData = res.getViewData();

	next();
});

module.exports = server.exports();
