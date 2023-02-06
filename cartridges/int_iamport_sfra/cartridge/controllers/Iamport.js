'use strict';

var server = require('server');
var iamportLogger = require('dw/system/Logger').getLogger('iamport', 'Iamport');
var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');
var iamportConstants = require('*/cartridge/constants/iamportConstants');

server.post('SfNotifyTest', function (req, res, next) {
	const OrderMgr = require('dw/order/OrderMgr');
	const HookMgr = require('dw/system/HookMgr');
	const Resource = require('dw/web/Resource');
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

/**
 * Create Iamport Subscription request for Request billing key.
 * @param {middleware} - userLoggedIn.validateLoggedInAjax
 */
server.get('RequestBillingKey', userLoggedIn.validateLoggedInAjax, function (req, res, next) {
	var URLUtils = require('dw/web/URLUtils');
	var Site = require('dw/system/Site');
	var Resource = require('dw/web/Resource');
	var iamportHelpers = require('*/cartridge/scripts/helpers/iamportHelpers');
	var pgValidators = require('*/cartridge/config/pgValidators');
	var selectedCardPaymentMethod = 'card';
	var selectedPaymentGateway = Site.getCurrent().getCustomPreferenceValue(iamportConstants.PG_ATTRIBUTE_ID)
		|| iamportConstants.PG_DEFAULT_FALLBACK;
	var paymentGateway = pgValidators[selectedPaymentGateway];
	// update the selected payment gateway ID for KCP Subscription Payment.
	var selectedpaymentGatewayID = selectedPaymentGateway.value.indexOf('kcp') > -1 ? 'kcp_billing' : selectedPaymentGateway.value;
	var storeID = Site.getCurrent().getCustomPreferenceValue(paymentGateway.subscriptionStoreID);
	// pass the multistore id in selected payment gateway ID if we have more than one.
	selectedpaymentGatewayID = !empty(storeID) ? selectedpaymentGatewayID + '.' + storeID : selectedpaymentGatewayID;
	var selectedPaymentMethods = Site.getCurrent().getCustomPreferenceValue(paymentGateway.paymentMethodsAttributeID);
	var validPaymentMethod = false;
	var enablePaymentWindow = false;
	var errorMsg = Resource.msg('error.payment.nopaymentselected', 'checkout', null);
	var paymentMethods = paymentGateway.paymentMethods;
	for (var i = 0; i < selectedPaymentMethods.length; i++) {
		if (selectedCardPaymentMethod === selectedPaymentMethods[i].value) {
			validPaymentMethod = true;
			break;
		}
	}
	for (var j = 0; j < paymentMethods.length; j++) {
		if (selectedCardPaymentMethod === paymentMethods[j].id && paymentMethods[j].paymentWindow) {
			enablePaymentWindow = true;
			break;
		}
	}
	if (validPaymentMethod && !enablePaymentWindow) {
		errorMsg = Resource.msg('error.payment.nopaymentwindow', 'checkout', null);
	}
	if (!validPaymentMethod || !enablePaymentWindow) {
		res.json({
			error: true,
			errorMsg: errorMsg,
			redirectUrl: URLUtils.url('PaymentInstruments-List').toString()
		});
		return next();
	}
	var data = res.getViewData();
	if (data && !data.loggedin) {
		res.json();
		return next();
	}
	var profile = req.currentCustomer.profile;
	var generalPaymentWebhookUrl = '';
	var order = {
		totalGrossPrice: {
			value: iamportConstants.TEST_SUBSCRIBE_AMOUNT
		},
		customerName: profile.firstName + ' ' + profile.lastName,
		isSubscription: true,
		orderNo: 'authsave_' + iamportHelpers.generateString(),
		customerEmail: profile.email,
		billingAddress: {
			phone: !empty(profile.phone) ? profile.phone : '0000000000',
			fullName: profile.firstName + ' ' + profile.lastName
		}
	};
	var mobileRedirectUrl = URLUtils.abs('PaymentInstruments-ListCardsForMobile').toString();
	var paymentResources = iamportHelpers.preparePaymentResources(order, selectedCardPaymentMethod, generalPaymentWebhookUrl, mobileRedirectUrl, selectedpaymentGatewayID);
	paymentResources.customer_uid = iamportHelpers.generateString() + '_' + profile.customerNo;
	res.json({
		error: false,
		paymentResources: paymentResources,
		validationUrl: URLUtils.url('Iamport-SaveBillingKey').toString()
	});
	return next();
});

/**
 * Save the billingKey(customer uid) as credit card token to the profile wallet .
 * @name Iamport-SaveBillingKey
 * @function
 * @memberof Iamport
 * @param {returns} - json
 */
server.post('SaveBillingKey', function (req, res, next) {
	var iamportHelpers = require('*/cartridge/scripts/helpers/iamportHelpers');
	var CustomError = require('*/cartridge/errors/customError');
	var URLUtils = require('dw/web/URLUtils');
	var paymentInformation = req.form;
	var customerUid = paymentInformation.customer_uid;
	try {
		// Make auth payment with the saved billing key to get credit card detials and save card details in wallet.
		var paymentResponse = iamportHelpers.handleSubcribePaymentRequest(req, customerUid);
		if (!paymentResponse.isOk() || paymentResponse.getObject().message) {
			var iamportResponseError = '';
			var errorcode = paymentResponse.error;
			iamportResponseError = paymentResponse.errorMessage;
			if (paymentResponse.msg && paymentResponse.errorMessage) {
				errorcode = JSON.parse(paymentResponse.errorMessage).code;
			} else if (paymentResponse.getObject() != null && paymentResponse.getObject().message) {
				errorcode = paymentResponse.getObject().code;
			}
			iamportResponseError = new CustomError({ status: errorcode }).message;
			res.json({
				error: true,
				errorMsg: iamportResponseError,
				redirectUrl: URLUtils.url('PaymentInstruments-List').toString()
			});
		} else {
			res.json({
				error: false,
				redirectUrl: URLUtils.url('PaymentInstruments-List').toString()
			});
		}
	} catch (e) {
		iamportLogger.error('Iamport-SaveBillingKey: \n{0}: {1}', e.message, e.stack);
	}

	return next();
});

module.exports = server.exports();
