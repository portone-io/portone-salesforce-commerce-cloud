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

	// TODO: the paymentInformation must be moved to a hook
	Object.assign(viewData, {
		paymentInformation: {
			pg: 'html5_inicis',
			pay_method: 'card',
			merchant_uid: 'ORD20180131-0000011',
			name: 'Norway swivel chair',
			amount: 100,
			buyer_email: 'johndoe@gmail.com',
			buyer_name: 'John Doe',
			buyer_tel: '010-4242-4242',
			buyer_addr: 'Shinsa-dong, Gangnam-gu, Seoul',
			buyer_postcode: '01181'
		},
		merchantID: Site.getCurrent().getCustomPreferenceValue(iamportConstants.PG_MID_ATTRIBUTE_ID),
		useIamportSFRA6: preferences.SFRA6_ENABLED
	});

	res.setViewData(viewData);

	next();
});

module.exports = server.exports();
