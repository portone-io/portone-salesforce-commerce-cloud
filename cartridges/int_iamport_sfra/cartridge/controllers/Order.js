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

	if (req.form.vbank) {
		Object.assign(viewData, {
			vbank: req.form.vbank,
			vbankName: req.form.vbankName,
			vbankNumber: req.form.vbankNumber,
			vbankExpiration: req.form.vbankExpiration,
			vbankIssuedAt: req.form.vbankIssuedAt,
			vbankCode: req.form.vbankCode,
			vbankHolder: req.form.vbankHolder
		});
	}

	res.setViewData(viewData);
	return next();
});

/**
 * Order-GetConfirmation : This endpoint is invoked when the shopper's Order is Placed and Confirmed in mobile
 * @name Custom/Order-GetConfirmation
 * @function
 * @memberof Order
 * @param {middleware} - server.middleware.https
 * @param {renders} - isml
 */
server.get('GetConfirmation', server.middleware.https, function (req, res, next) {
	var iamportLogger = require('dw/system/Logger').getLogger('iamport', 'Iamport');
	var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
	var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
	var OrderMgr = require('dw/order/OrderMgr');
	var Resource = require('dw/web/Resource');
	var URLUtils = require('dw/web/URLUtils');
	var Transaction = require('dw/system/Transaction');
	var HookMgr = require('dw/system/HookMgr');
	var iamportServices = require('*/cartridge/scripts/service/iamportService');
	var iamportHelpers = require('*/cartridge/scripts/helpers/iamportHelpers');
	var addressHelpers = require('*/cartridge/scripts/helpers/addressHelpers');
	var CustomError = require('*/cartridge/errors/customError');
	var reportingUrlsHelper = require('*/cartridge/scripts/reportingUrls');
	var OrderModel = require('*/cartridge/models/order');
	var Locale = require('dw/util/Locale');
	var paymentInformation = req.querystring;
	var mappedPaymentInfo = '';

	if (empty(paymentInformation) || !('imp_uid' in paymentInformation) || !('merchant_uid' in paymentInformation) || empty(paymentInformation.imp_uid) || empty(paymentInformation.merchant_uid)) {
		iamportLogger.error('GetConfirmation: query parameters must contain imp_uid {0} and merchant_uid {1}.', paymentInformation.imp_uid, paymentInformation.merchant_uid);
		res.render('/error', {
			message: Resource.msg('error.confirmation.error', 'confirmation', null)
		});
		return next();
	}
	var orderID = paymentInformation.merchant_uid;
	var token = paymentInformation.token;
	var order = OrderMgr.getOrder(orderID, token);
	var paymentID = paymentInformation.imp_uid;
	var config = {
		numberOfLineItems: '*'
	};
	var currentLocale = Locale.getLocale(req.locale.id);
	var passwordForm;
	var reportingURLs = reportingUrlsHelper.getOrderReportingURLs(order);

	// token in url parameter and order token should always same.
	if (!order
		|| !token
		|| token !== order.orderToken
		|| order.customer.ID !== req.currentCustomer.raw.ID
	) {
		res.render('/error', {
			message: Resource.msg('error.confirmation.error', 'confirmation', null)
		});

		return next();
	}

	// not allow to customer hit the same endpoint after place the order.
	var lastOrderID = Object.prototype.hasOwnProperty.call(req.session.raw.custom, 'orderID') ? req.session.raw.custom.orderID : null;
	if (lastOrderID === orderID) {
		res.redirect(URLUtils.url('Home-Show'));
		return next();
	}

	// get the payment Data from pass iamport id in url parameter.
	var paymentData = iamportServices.getPaymentInformation.call({
		paymentID: paymentID
	});
	// if imp_success is true, we will place the order and if imp_success is false, we will failed the order
	if (('imp_success' in paymentInformation && paymentInformation.imp_success === 'true') || ('success' in paymentInformation && paymentInformation.success === 'true')) {
		// Handles payment authorization
		var handlePaymentResult = COHelpers.handlePayments(order, order.orderNo);

		if (handlePaymentResult.error) {
			res.redirect(URLUtils.url('Cart-Show', 'err', '05'));
			return next();
		}

		if (req.currentCustomer.addressBook) {
			// save all used shipping addresses to address book of the logged in customer
			var allAddresses = addressHelpers.gatherShippingAddresses(order);
			allAddresses.forEach(function (address) {
				if (!addressHelpers.checkIfAddressStored(address, req.currentCustomer.addressBook.addresses)) {
					addressHelpers.saveAddress(address, req.currentCustomer, addressHelpers.generateAddressName(address));
				}
			});
		}

		if (!paymentData.isOk()) {
			iamportLogger.error('Server failed to retrieve payment data for "{0}": {1}.', paymentID, JSON.stringify(paymentData));
			var customError = new CustomError({ status: paymentData.getError() });

			COHelpers.recreateCurrentBasket(order, 'Order failed', customError.note);
			res.redirect(URLUtils.url('Cart-Show', 'err', paymentData.getError().toString()));
			return next();
		}

		// save the payment id in a custom attribute on the Order object
		var paymentResponse = paymentData.getObject().response;
		var paymentId = paymentResponse.imp_uid;
		hooksHelper('app.payment.processor.iamport',
			'updatePaymentIdOnOrder',
			paymentId,
			order,
			require('*/cartridge/scripts/hooks/payment/processor/iamportPayments').updatePaymentIdOnOrder
		);

		hooksHelper('app.payment.processor.iamport',
			'updateTransactionIdOnOrder',
			paymentId,
			order,
			require('*/cartridge/scripts/hooks/payment/processor/iamportPayments').updateTransactionIdOnOrder
		);

		var fraudDetectionStatus = hooksHelper('app.fraud.detection', 'fraudDetection', paymentData, order, require('*/cartridge/scripts/hooks/fraudDetection').fraudDetection);
		if (fraudDetectionStatus.status === 'fail') {
			Transaction.wrap(function () {
				OrderMgr.failOrder(order, true);
				COHelpers.addOrderNote(order,
					Resource.msg('order.note.payment.incomplete.subject', 'order', null),
					fraudDetectionStatus.errorMessage);
			});
			// fraud detection failed
			req.session.privacyCache.set('fraudDetectionStatus', true);
			res.redirect(URLUtils.url('Error-ErrorCode', 'err', fraudDetectionStatus.errorCode));
			return next();
		}

		var validationResponse = {
			error: false,
			orderID: order.orderNo,
			orderToken: order.orderToken,
			continueUrl: URLUtils.url('Order-Confirm').toString()
		};

		var vbankExpiration = COHelpers.getTimeWithPreferredTimeZone(paymentResponse.vbank_date);
		var vbankIssuedAt = COHelpers.getTimeWithPreferredTimeZone(paymentResponse.vbank_issued_at);

		if (paymentResponse.pay_method === 'vbank') {
			Object.assign(validationResponse, {
				vbank: true,
				vbankPayload: {
					vbankName: paymentResponse.vbank_name,
					vbankNumber: paymentResponse.vbank_num,
					vbankExpiration: vbankExpiration,
					vbankCode: paymentResponse.vbank_code,
					vbankIssuedAt: vbankIssuedAt,
					vbankHolder: paymentResponse.vbank_holder
				}
			});
			if (HookMgr.hasHook('app.payment.processor.iamport')) {
				HookMgr.callHook('app.payment.processor.iamport',
					'updateVbankOnOrder',
					validationResponse.vbank,
					validationResponse.vbankPayload,
					order
				);
			}
			res.setViewData({
				vbank: validationResponse.vbank,
				vbankName: validationResponse.vbankPayload.vbankName,
				vbankNumber: validationResponse.vbankPayload.vbankNumber,
				vbankExpiration: validationResponse.vbankPayload.vbankExpiration,
				vbankIssuedAt: validationResponse.vbankPayload.vbankIssuedAt,
				vbankCode: validationResponse.vbankPayload.vbankCode,
				vbankHolder: validationResponse.vbankPayload.vbankHolder
			});

			mappedPaymentInfo = iamportHelpers.mapVbankResponseForLogging(paymentData);
			iamportLogger.debug('Virtual Payment Information: {0}.', JSON.stringify(mappedPaymentInfo));
		} else {
			// Places the order
			var placeOrderResult = COHelpers.placeOrder(order, fraudDetectionStatus);
			if (placeOrderResult.error) {
				res.redirect(URLUtils.url('Cart-Show', 'err', placeOrderResult.error.toString()));
				return next();
			}

			// Reset usingMultiShip after successful Order placement
			req.session.privacyCache.set('usingMultiShipping', false);

			mappedPaymentInfo = iamportHelpers.mapPaymentResponseForLogging(paymentData);
			iamportLogger.debug('Payment Information: {0}.', JSON.stringify(mappedPaymentInfo));
		}

		res.setViewData({
			selectedPaymentMethod: order.custom.pay_method
		});

		var orderModel = new OrderModel(
			order,
			{ config: config, countryCode: currentLocale.country, containerView: 'order' }
		);
		if (!req.currentCustomer.profile) {
			passwordForm = server.forms.getForm('newPasswords');
			passwordForm.clear();
			res.render('checkout/confirmation/confirmation', {
				order: orderModel,
				returningCustomer: false,
				passwordForm: passwordForm,
				reportingURLs: reportingURLs,
				orderUUID: order.getUUID()
			});
		} else {
			res.render('checkout/confirmation/confirmation', {
				order: orderModel,
				returningCustomer: true,
				reportingURLs: reportingURLs,
				orderUUID: order.getUUID()
			});
		}
		req.session.raw.custom.orderID = orderID;
	} else {
		var iamportErrorMessage = paymentInformation.error_msg;
		iamportLogger.error('Iamport server responded with an error: {0}.', iamportErrorMessage);

		COHelpers.recreateCurrentBasket(order,
			Resource.msg('order.note.payment.incomplete.subject', 'order', null),
			Resource.msg('order.note.payment.incomplete.body', 'order', null));

		res.redirect(URLUtils.url('Cart-Show', 'err', '02').toString());
	}
	return next();
});

module.exports = server.exports();
