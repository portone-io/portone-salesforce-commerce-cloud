'use strict';

const server = require('server');
server.extend(module.superModule);
const iamportHelpers = require('*/cartridge/scripts/helpers/iamportHelpers');
var iamportLogger = require('dw/system/Logger').getLogger('iamport', 'Iamport');

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
	const BasketMgr = require('dw/order/BasketMgr');

	let viewData = res.getViewData();
	let currentBasket = BasketMgr.getCurrentBasket();

	Object.assign(viewData, {
		merchantID: Site.getCurrent().getCustomPreferenceValue(iamportConstants.PG_MID_ATTRIBUTE_ID),
		useIamportSFRA5: preferences.SFRA5_ENABLED,
		selectedPaymentMethod: currentBasket.custom.pay_method
	});

	res.setViewData(viewData);

	next();
});

server.post('HandleCancel', function (req, res, next) {
	const OrderMgr = require('dw/order/OrderMgr');
	const URLUtils = require('dw/web/URLUtils');
	const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
	const Resource = require('dw/web/Resource');

	let orderToken = req.form.orderToken;
	let orderId = req.form.merchant_uid;
	let iamportErrorMessage = req.form.errorMsg;
	let order = null;

	iamportLogger.error('Iamport server responded with an error: {0}.', iamportErrorMessage);

	if (orderId && orderToken) {
		order = OrderMgr.getOrder(orderId, orderToken);
	}

	COHelpers.recreateCurrentBasket(order,
		Resource.msg('order.note.payment.incomplete.subject', 'order', null),
		Resource.msg('order.note.payment.incomplete.body', 'order', null));

	res.json({
		redirectUrl: URLUtils.url('Cart-Show', 'error', true,
			'errorMessage',
			Resource.msg('error.payment.incomplete', 'checkout', null)).toString()
	});

	return next();
});

server.post('HandlePaymentRequestFailure', function (req, res, next) {
	const OrderMgr = require('dw/order/OrderMgr');
	const URLUtils = require('dw/web/URLUtils');
	const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
	const Resource = require('dw/web/Resource');

	let orderToken = req.form.orderToken;
	let orderId = req.form.merchant_uid;
	let iamportErrorMessage = req.form.errorMsg;
	let order = null;

	let iamportErrorCode = req.form.errorCode;
	let translatedError = iamportHelpers.handleErrorFromPaymentGateway(iamportErrorCode, iamportErrorMessage);

	iamportLogger.error('Iamport server responded with an error: code={0} - description={1}', iamportErrorCode, translatedError);

	if (orderId && orderToken) {
		order = OrderMgr.getOrder(orderId, orderToken);
	}

	COHelpers.recreateCurrentBasket(order,
		Resource.msg('order.note.payment.incomplete.subject', 'order', null),
		Resource.msg('order.note.payment.incomplete.body', 'order', null));

	res.json({
		redirectUrl: URLUtils.url('Cart-Show', 'error', true,
			'errorMessage',
			Resource.msg('error.technical', 'checkout', null)).toString()
	});

	return next();
});

module.exports = server.exports();
