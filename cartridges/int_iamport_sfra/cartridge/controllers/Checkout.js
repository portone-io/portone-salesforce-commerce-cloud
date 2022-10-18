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
	const preferences = require('*/cartridge/config/preferences');
	const iamportConstants = require('*/cartridge/constants/iamportConstants');
	const Site = require('dw/system/Site');

	let viewData = res.getViewData();

	Object.assign(viewData, {
		merchantID: Site.getCurrent().getCustomPreferenceValue(iamportConstants.PG_MID_ATTRIBUTE_ID),
		useIamportSFRA5: preferences.SFRA5_ENABLED
	});

	res.setViewData(viewData);

	next();
});

module.exports = server.exports();
