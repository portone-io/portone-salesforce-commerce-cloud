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
	let order = OrderMgr.getOrder(viewData.order.orderNumber);

	Object.assign(viewData, {
		selectedPaymentMethod: order.custom.pay_method
	});

	return next();
});

module.exports = server.exports();
