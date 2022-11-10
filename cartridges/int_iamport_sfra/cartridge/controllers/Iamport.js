'use strict';

const server = require('server');

server.post('SfNotifyTest', function (req, res, next) {
	const OrderMgr = require('dw/order/OrderMgr');
	const HookMgr = require('dw/system/HookMgr');
	const Logger = require('dw/system/Logger').getLogger('iamport', 'Iamport');
	const Resource = require('dw/web/Resource');
	const iamportConstants = require('*/cartridge/constants/iamportConstants');
	const iamportServices = require('*/cartridge/scripts/service/iamportService');
	const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
	const iamportHelpers = require('*/cartridge/scripts/helpers/iamportHelpers');

	let webhookData = JSON.parse(req.body);
	let order;
	let paymentData;
	let postAuthorization;
	let orderCancellation;
	let mappedPaymentInfo;

	let testPoints = {
		payment: 'payment',
		cancellation: 'cancellation',
		vbankIssued: 'vbank'
	};
	let whatToTest = testPoints.payment;

	order = OrderMgr.getOrder(iamportConstants.TEST_ORDER);
	paymentData = iamportServices.getPaymentInformation.call({
		paymentID: iamportConstants.TEST_PAYMENT
	});

	if (!paymentData.isOk()) {
		Logger.error('No payment data retrieved in webhook. Check the payment service.');
		return next();
	}

	try {
		if (webhookData.status !== 'ready') {
			throw new Error('Thw webhook status is not a test status');
		}

		switch (whatToTest) {
			// test payment approval
			case testPoints.payment:
				if (HookMgr.hasHook('app.payment.processor.iamport')) {
					postAuthorization = HookMgr.callHook('app.payment.processor.iamport',
						'postAuthorize',
						order,
						paymentData,
						req
					);
				}

				if (postAuthorization.success) {
					if (order.getCustomerEmail()) {
						COHelpers.sendConfirmationEmail(order, req.locale.id, true);
					}
				}

				mappedPaymentInfo = iamportHelpers.mapPaymentResponseForLogging(paymentData);
				Logger.debug('Webhook: Payment Information: {0}.', JSON.stringify(mappedPaymentInfo));

				COHelpers.addOrderNote(order,
					Resource.msg('order.note.payment.complete.subject', 'order', null),
					Resource.msg('order.note.payment.complete.body', 'order', null));
				break;

			// test payment cancellation
			case testPoints.cancellation:
				if (HookMgr.hasHook('app.payment.processor.iamport')) {
					orderCancellation = HookMgr.callHook('app.payment.processor.iamport',
						'cancelOrder',
						order
					);
				}

				if (orderCancellation.success) {
					if (order.getCustomerEmail()) {
					// send cancellation email to customer
						COHelpers.sendPaymentOrderCancellationEmail(order, req.locale.id, true);
					}
				}

				COHelpers.addOrderNote(order,
					Resource.msg('order.note.payment.cancelled.subject', 'order', null),
					Resource.msg('order.note.payment.cancelled.body', 'order', null));
				break;

			// test when virtual account is issued
			case testPoints.vbankIssued:
				//
				break;

			default:
				break;
		}

		Logger.debug('Webhook called successfully. Webhook response: {0}.', JSON.stringify(webhookData));
		// return success message to the import server
		res.print('WebhookTest: success');
		return next();
	} catch (err) {
		Logger.error('Webhook test failed: {0}', JSON.stringify(err));
		res.setStatusCode(500);
		res.print(err.message);
		return next();
	}
});

server.post('SfNotifyHook', function (req, res, next) {
	const OrderMgr = require('dw/order/OrderMgr');
	const HookMgr = require('dw/system/HookMgr');
	const Logger = require('dw/system/Logger').getLogger('iamport', 'Iamport');
	const Resource = require('dw/web/Resource');
	const iamportServices = require('*/cartridge/scripts/service/iamportService');
	const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
	const iamportHelpers = require('*/cartridge/scripts/helpers/iamportHelpers');

	let webhookData = JSON.parse(req.body);
	let status = webhookData.status;
	let orderId = webhookData.merchant_uid;
	let paymentId = webhookData.imp_uid;
	let postAuthorization;
	let orderCancellation;
	let mappedPaymentInfo;

	let order = OrderMgr.getOrder(orderId);
	let paymentData = iamportServices.getPaymentInformation.call({
		paymentID: paymentId
	});

	if (!paymentData.isOk()) {
		Logger.error('No payment data retrieved in webhook. Check the payment service.');
		return next();
	}

	try {
		switch (status) {
			// when virtual account is issued
			case 'ready':
				orderId = '00000';
				break;

			// when payment is approved or payment amount is deposited into virtual account
			case 'paid':
				if (HookMgr.hasHook('app.payment.processor.iamport')) {
					postAuthorization = HookMgr.callHook('app.payment.processor.iamport',
						'postAuthorize',
						order,
						paymentData,
						req
					);
				}

				if (postAuthorization.success) {
					if (order.getCustomerEmail()) {
						COHelpers.sendConfirmationEmail(order, req.locale.id, true);
					}
				}

				mappedPaymentInfo = iamportHelpers.mapPaymentResponseForLogging(paymentData);
				Logger.debug('Webhook: Payment Information: {0}.', JSON.stringify(mappedPaymentInfo));

				COHelpers.addOrderNote(order,
					Resource.msg('order.note.payment.complete.subject', 'order', null),
					Resource.msg('order.note.payment.complete.body', 'order', null));

				break;

			// when payment is cancelled in admin console
			case 'cancelled':
				if (HookMgr.hasHook('app.payment.processor.iamport')) {
					orderCancellation = HookMgr.callHook('app.payment.processor.iamport',
						'cancelOrder',
						order
					);
				}

				if (orderCancellation.success) {
					if (order.getCustomerEmail()) {
						// send cancellation email to customer
						COHelpers.sendPaymentOrderCancellationEmail(order, req.locale.id, true);
					}
				}

				COHelpers.addOrderNote(order,
					Resource.msg('order.note.payment.cancelled.subject', 'order', null),
					Resource.msg('order.note.payment.cancelled.body', 'order', null));

				break;
			default:
				break;
		}

		Logger.debug('Webhook called successfully. Webhook response: {0}.', JSON.stringify(webhookData));
		// return success message to the import server
		res.print('WebhookCall: success');
		return next();
	} catch (err) {
		Logger.error('Webhook failed: {0}', JSON.stringify(err));
		res.print(err.message);
		return next();
	}
});

module.exports = server.exports();
