'use strict';

const server = require('server');

server.post('SfNotifyHook', function (req, res, next) {
	const OrderMgr = require('dw/order/OrderMgr');
	const iamportConstants = require('*/cartridge/constants/iamportConstants');
	const iamportServices = require('*/cartridge/scripts/service/iamportService');
	const HookMgr = require('dw/system/HookMgr');
	const Logger = require('dw/system/Logger').getLogger('iamport', 'Iamport');
	const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
	const Resource = require('dw/web/Resource');

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
			Logger.error('No payment data retrieved. Check the payment service');
			return next();
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

					COHelpers.addOrderNote(order,
						Resource.msg('order.note.payment.complete.subject', 'order', null),
						Resource.msg('order.note.payment.complete.body', 'order', null));
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

					COHelpers.addOrderNote(order,
						Resource.msg('order.note.payment.cancelled.subject', 'order', null),
						Resource.msg('order.note.payment.cancelled.body', 'order', null));
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

				COHelpers.addOrderNote(order,
					Resource.msg('order.note.payment.complete.subject', 'order', null),
					Resource.msg('order.note.payment.complete.body', 'order', null));

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

				COHelpers.addOrderNote(order,
					Resource.msg('order.note.payment.cancelled.subject', 'order', null),
					Resource.msg('order.note.payment.cancelled.body', 'order', null));

				break;
			default:
				break;
		}

		Logger.debug('Webhook called successfully. Webhook response: ', JSON.stringify(webhookData));
		// return success message to the import server
		res.setStatusCode(200).print('WebhookCall: success');
		return next();
	} catch (err) {
		Logger.error('Webhook failed: ' + JSON.stringify(err));
		res.setStatusCode(500).print(err.message);
		return next();
	}
});

module.exports = server.exports();
