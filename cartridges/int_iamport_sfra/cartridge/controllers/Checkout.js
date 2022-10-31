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

server.post('HandleCancel', function (req, res, next) {
	const Transaction = require('dw/system/Transaction');
	const OrderMgr = require('dw/order/OrderMgr');
	const BasketMgr = require('dw/order/BasketMgr');
	const URLUtils = require('dw/web/URLUtils');
	const Logger = require('dw/system/Logger').getLogger('iamport', 'Iamport');

	let orderToken = req.form.orderToken;
	let orderId = req.form.merchant_uid;
	let iamportErrorMessage = req.form.errorMsg;
	let order = null;

	Logger.error('Iamport server responded with an error: ' + iamportErrorMessage);

	if (orderId && orderToken) {
		order = OrderMgr.getOrder(orderId, orderToken);
	}

	if (!empty(order)) {
		// recreate the basket from the current order and fail the order afterwards
		let currentBasket = BasketMgr.getCurrentOrNewBasket();
		let defaultShipment = currentBasket.getDefaultShipment();

		Transaction.wrap(function () {
			order.getProductLineItems().toArray().forEach((productLineItem) => {
				let newProductLineItem = currentBasket.createProductLineItem(productLineItem.productID, defaultShipment);
				newProductLineItem.setQuantityValue(productLineItem.getQuantityValue());
			});

			OrderMgr.failOrder(order, true);
		});
	}

	res.json({
		redirectUrl: URLUtils.url('Cart-Show').toString()
	});

	return next();
});

server.post('BeginPOC', function (req, res, next) {
	const URLUtils = require('dw/web/URLUtils');
	const iamportHelpers = require('*/cartridge/scripts/helpers/iamportHelpers');
	const iamportConstants = require('*/cartridge/constants/iamportConstants');
	const OrderMgr = require('dw/order/OrderMgr');

	let order = OrderMgr.getOrder(iamportConstants.TEST_ORDER);
	let selectedPaymentMethod = req.querystring.pm;
	let paymentResources = iamportHelpers.preparePaymentResources(order, selectedPaymentMethod);

	res.json({
		validationUrl: URLUtils.url('CheckoutServices-ValidatePlaceOrder').toString(),
		paymentResources: paymentResources
	});

	return next();
});

module.exports = server.exports();
