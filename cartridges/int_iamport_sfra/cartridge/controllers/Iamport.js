'use strict';

const server = require('server');
const iamportLogger = require('dw/system/Logger').getLogger('iamport', 'Iamport');

server.post('SfNotifyTest', function (req, res, next) {
	const OrderMgr = require('dw/order/OrderMgr');
	const HookMgr = require('dw/system/HookMgr');
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
	let whatToTest = testPoints.vbankIssued;

	order = OrderMgr.getOrder(iamportConstants.TEST_ORDER);
	paymentData = iamportServices.getPaymentInformation.call({
		paymentID: iamportConstants.TEST_PAYMENT
	});

	if (!paymentData.isOk()) {
		iamportLogger.error('No payment data retrieved in webhook. Check the payment service.');
		return next();
	}

	try {
		if (webhookData.status !== 'ready') {
			throw new Error('The webhook status is not a test status');
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
				iamportLogger.debug('Webhook: Payment Information: {0}.', JSON.stringify(mappedPaymentInfo));

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
				if (order.getCustomerEmail()) {
					COHelpers.sendVbankIssuanceEmail(order, paymentData);
				}
				break;

			default:
				break;
		}

		iamportLogger.debug('Webhook called successfully. Webhook response: {0}.', JSON.stringify(webhookData));
		// return success message to the import server
		res.print('WebhookTest: success');
		return next();
	} catch (err) {
		iamportLogger.error('Webhook test failed: {0}', JSON.stringify(err));
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
	const Resource = require('dw/web/Resource');
	const Transaction = require('dw/system/Transaction');
	const iamportServices = require('*/cartridge/scripts/service/iamportService');
	const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
	const iamportHelpers = require('*/cartridge/scripts/helpers/iamportHelpers');
	var hooksHelper = require('*/cartridge/scripts/helpers/hooks');

	let webhookData = JSON.parse(req.body);
	let status = webhookData.status;
	let orderId = webhookData.merchant_uid;
	let paymentId = webhookData.imp_uid;
	let postAuthorization;
	let orderCancellation;
	let vbankIssued;
	let mappedPaymentInfo;

	var order = OrderMgr.getOrder(orderId);
	let paymentData = iamportServices.getPaymentInformation.call({
		paymentID: paymentId
	});
	if (!paymentData.isOk()) {
		iamportLogger.error('No payment data retrieved in webhook. Check the payment service.');
		return next();
	}
	try {
		var paidAmount = paymentData.getObject().response.amount;
		var fraudDetectionStatus = hooksHelper('app.fraud.detection', 'fraudDetection', paymentData, order, require('*/cartridge/scripts/hooks/fraudDetection').fraudDetection);
		if (fraudDetectionStatus.status === 'success') {
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
						iamportLogger.error('The order must be in the CREATED status when vbank accounts are issued');
						throw new Error('Incorrect Order Status');
					}

					if (order.getCustomerEmail()) {
						COHelpers.sendVbankIssuanceEmail(order, paymentData);
					}

					mappedPaymentInfo = iamportHelpers.mapVbankResponseForLogging(paymentData);
					iamportLogger.debug('Webhook: Payment Information: {0}.', JSON.stringify(mappedPaymentInfo));

					COHelpers.addOrderNote(order,
						Resource.msg('order.note.vbank.subject', 'order', null),
						Resource.msg('order.note.vbank.issued.body', 'order', null));

					break;

				// when payment is approved or payment amount is deposited into virtual account
				case 'paid':
					if (paymentData.getObject().response.pay_method === 'vbank') {
						if ('imp_uid' in order.custom && !empty(order.custom.imp_uid) && order.custom.imp_uid === paymentData.getObject().response.imp_uid) {
							var placeOrderResult = COHelpers.placeOrder(order, fraudDetectionStatus);
							if (placeOrderResult.error) {
								COHelpers.addOrderNote(order,
									Resource.msg('order.note.vbank.subject', 'order', null),
									Resource.msgf('order.note.vbank.paidpayment.notcomplete.body', 'order', null, paidAmount));
								iamportLogger.error('Order could not be placed: {0}', JSON.stringify(placeOrderResult));
								throw new Error(Resource.msg('error.technical', 'checkout', null));
							}

							// Reset usingMultiShip after successful Order placement
							req.session.privacyCache.set('usingMultiShipping', false);

							mappedPaymentInfo = iamportHelpers.mapVbankResponseForLogging(paymentData);
							iamportLogger.debug('data: {0}', JSON.stringify(paymentData));
							iamportLogger.debug('Webhook: Virtual Payment Information: {0}.', JSON.stringify(mappedPaymentInfo));

							let importPaymentInfoResponse = paymentData.getObject().response;
							let paidDate = COHelpers.getTimeWithPreferredTimeZone(importPaymentInfoResponse.paid_at);
							COHelpers.addOrderNote(order,
								Resource.msg('order.note.vbank.subject', 'order', null),
								Resource.msgf('order.note.vbank.paidpayment.complete.body', 'order', null, paidAmount, paidDate));
						} else {
							Transaction.wrap(function () {
								OrderMgr.failOrder(order, true);
								COHelpers.addOrderNote(order,
									Resource.msg('order.note.vbank.subject', 'order', null),
									Resource.msg('order.error.missed.iamport.uid', 'order', null)
								);
							});
							iamportLogger.error('Order could not be placed: {0}', Resource.msg('order.error.missed.iamport.uid', 'order', null));
							throw new Error(Resource.msgf('order.error.missed.iamport.uid', 'order', null, paidAmount));
						}
					} else {
						mappedPaymentInfo = iamportHelpers.mapPaymentResponseForLogging(paymentData);
						iamportLogger.debug('Webhook: Payment Information: {0}.', JSON.stringify(mappedPaymentInfo));

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

			iamportLogger.debug('Webhook called successfully. Webhook response: {0}.', JSON.stringify(webhookData));
			// return success message to the import server
			res.setStatusCode(200);
			res.print('WebhookCall: success');
		} else {
			Transaction.wrap(function () {
				OrderMgr.failOrder(order, true);
				COHelpers.addOrderNote(order,
					Resource.msg('order.note.vbank.subject', 'order', null),
					Resource.msg('order.error.fraud.detected', 'order', null)
				);
			});
			iamportLogger.error('Order could not be placed: {0}', Resource.msg('order.error.fraud.detected', 'order', null));
			throw new Error(Resource.msg('order.error.fraud.detected', 'order', null));
		}
		return next();
	} catch (err) {
		iamportLogger.error('Webhook failed: {0}', JSON.stringify(err));
		res.setStatusCode(400);
		res.print(err.message);
		return next();
	}
});

module.exports = server.exports();
