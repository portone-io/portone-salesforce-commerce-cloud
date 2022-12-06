'use strict';

const server = require('server');
server.extend(module.superModule);

/**
 * Order-Confirm : This endpoint is invoked when the shopper's Order is Placed and Confirmed
 * @extend Base/Order-Confirm
 * @function
 * @memberof Order
 */
server.append('Confirm', function (req, res, next) {
	const OrderMgr = require('dw/order/OrderMgr');

	let viewData = res.getViewData();
	let order = OrderMgr.getOrder(req.form.orderID, req.form.orderToken);
	viewData.selectedPaymentMethod = order.custom.pay_method;
	let vbankExpirationDate = new Date(req.form.vbankExpiration);
	let vbankIssuedDate = new Date(req.form.vbankIssuedAt);

	if (req.form.vbank) {
		Object.assign(viewData, {
			vbank: req.form.vbank,
			vbankName: req.form.vbankName,
			vbankNumber: req.form.vbankNumber,
			vbankExpiration: vbankExpirationDate,
			vbankIssuedAt: vbankIssuedDate,
			vbankCode: req.form.vbankCode,
			vbankHolder: req.form.vbankHolder
		});
	}

	res.setViewData(viewData);
	return next();
});

module.exports = server.exports();
