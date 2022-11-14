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

/**
 * Iamport-SfNotifyHook : this endpoint will be responsible for receiving all real-time iamport webhook notifications
 * @base Iamport/Iamport-SfNotifyHook
 * @function
 * @memberof Iamport
 * @param {returns} - text
 * @param {serverfunction} - post
 */
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
	let vbankIssued;
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
				if (HookMgr.hasHook('app.payment.processor.iamport')) {
					vbankIssued = HookMgr.callHook('app.payment.processor.iamport',
						'vbankIssued',
						order
					);
				}

				if (vbankIssued.error) {
					Logger.error('The order must be in the CREATED status when vbank accounts are issued');
					throw new Error('Incorrect Order Status');
				}

				if (order.getCustomerEmail()) {
					// TODO: send the customer an email of the virtual account details
				}

				mappedPaymentInfo = iamportHelpers.mapVbankResponseForLogging(paymentData);
				Logger.debug('Webhook: Payment Information: {0}.', JSON.stringify(mappedPaymentInfo));

				COHelpers.addOrderNote(order,
					Resource.msg('order.note.vbank.subject', 'order', null),
					Resource.msg('order.note.vbank.issued.body', 'order', null));

				break;

			// when payment is approved or payment amount is deposited into virtual account
			case 'paid':
				if (paymentData.getObject().response.pay_method === 'vbank') {
					let placeOrderResult = COHelpers.placeOrder(order);
					if (placeOrderResult.error) {
						Logger.error('Order could not be placed: {0}', JSON.stringify(placeOrderResult));
						throw new Error(Resource.msg('error.technical', 'checkout', null));
					}

					// Reset usingMultiShip after successful Order placement
					req.session.privacyCache.set('usingMultiShipping', false);

					mappedPaymentInfo = iamportHelpers.mapVbankResponseForLogging(paymentData);
					Logger.debug('data: {0}', JSON.stringify(paymentData));
					Logger.debug('Webhook: Virtual Payment Information: {0}.', JSON.stringify(mappedPaymentInfo));

					COHelpers.addOrderNote(order,
						Resource.msg('order.note.vbank.subject', 'order', null),
						Resource.msg('order.note.vbank.payment.complete.body', 'order', null));
				} else {
					mappedPaymentInfo = iamportHelpers.mapPaymentResponseForLogging(paymentData);
					Logger.debug('Webhook: Payment Information: {0}.', JSON.stringify(mappedPaymentInfo));

					COHelpers.addOrderNote(order,
						Resource.msg('order.note.payment.complete.subject', 'order', null),
						Resource.msg('order.note.payment.complete.body', 'order', null));
				}

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
		res.setStatusCode(200);
		res.print('WebhookCall: success');
		return next();
	} catch (err) {
		Logger.error('Webhook failed: {0}', JSON.stringify(err));
		res.setStatusCode(500);
		res.print(err.message);
		return next();
	}
});

module.exports = server.exports();
