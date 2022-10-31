'use strict';

const server = require('server');

server.post('SfNotifyHook', function (req, res, next) {
	const OrderMgr = require('dw/order/OrderMgr');
	const iamportConstants = require('*/cartridge/constants/iamportConstants');
	const iamportServices = require('*/cartridge/scripts/service/iamportService');
	const HookMgr = require('dw/system/HookMgr');
	const Logger = require('dw/system/Logger').getLogger('iamport', 'Iamport');
	const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');

	let webhookData = JSON.parse(req.body);
	let status = webhookData.status;
	let orderId = webhookData.merchant_uid;
	let paymentId = webhookData.imp_uid;
	let order;
	let paymentData;
	let postAuthorization;
	let orderCancellation;
	let whatToTest = 'payment';

	try {
		order = OrderMgr.getOrder(orderId);
		paymentData = iamportServices.getPaymentInformation.call({
			paymentID: paymentId
		});

		if (!paymentData.isOk()) {
			Logger.error('Payment data is empty. Check the payment service');
		}

		switch (status) {
			// testing and virtual payments. TODO: remove test codes
			case 'ready':
				order = OrderMgr.getOrder(iamportConstants.TEST_ORDER);
				paymentData = iamportServices.getPaymentInformation.call({
					paymentID: iamportConstants.TEST_PAYMENT
				});

				if (whatToTest === 'payment') {
					// Test payment authorization
					postAuthorization = HookMgr.callHook('app.payment.processor.iamport',
						'postAuthorize',
						order,
						paymentData,
						req
					);

					Logger.debug('merchant_uid: ' + webhookData.merchant_uid);
					Logger.debug('imp_uid: ' + webhookData.imp_uid);

					if (postAuthorization.success) {
						if (order.getCustomerEmail()) {
							COHelpers.sendConfirmationEmail(order, req.locale.id, true);
						}
					}
				} else if (whatToTest === 'cancellation') {
					// Test cancellation
					orderCancellation = HookMgr.callHook('app.payment.processor.iamport',
						'cancelOrder',
						order
					);

					if (orderCancellation.success) {
						if (order.getCustomerEmail()) {
							// send cancellation email to customer
						}
					}
				} else if (whatToTest === 'vbank') {
					// Test vbank payments
				} else if (whatToTest === 'escrow') {
					// Test escrow payments
				}

				break;
			// when payment is successful
			case 'paid':
				postAuthorization = HookMgr.callHook('app.payment.processor.iamport',
					'postAuthorize',
					order,
					paymentData,
					req
				);

				Logger.debug('merchant_uid: ' + webhookData.merchant_uid);
				Logger.debug('imp_uid: ' + webhookData.imp_uid);
				Logger.debug('paymentInfo: ' + JSON.stringify(paymentData));

				if (postAuthorization.success) {
					if (order.getCustomerEmail()) {
						COHelpers.sendConfirmationEmail(order, req.locale.id, true);
					}
				}

				break;
			// payment cancelled and refund initiated
			case 'cancelled':

				orderCancellation = HookMgr.callHook('app.payment.processor.iamport',
					'cancelOrder',
					order
				);

				if (orderCancellation.success) {
					if (order.getCustomerEmail()) {
						// send cancellation email to customer
					}
				}

				break;
			default:
				break;
		}

		Logger.debug('Webhook called successfully');

		res.print('success');
		return next();
	} catch (err) {
		// TODO: log error
		Logger.error('Webhook failed: ' + err);
		res.setStatusCode(400).print(err);
		return next();
	}
});

module.exports = server.exports();
