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
 * Order-GetConfirmation : The Account-EditProfile endpoint renders the page that allows a shopper to edit their profile. The edit profile form is prefilled with the shopper's first name, last name, phone number and email
 * @name Custom/Order-GetConfirmation
 * @function
 * @memberof Order
 * @param {middleware} - server.middleware.https
 * @param {renders} - isml
 */
server.get('GetConfirmation', server.middleware.https, function (req, res, next) {
	const iamportLogger = require('dw/system/Logger').getLogger('iamport', 'Iamport');
	const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
	const hooksHelper = require('*/cartridge/scripts/helpers/hooks');
	const OrderMgr = require('dw/order/OrderMgr');
	const Resource = require('dw/web/Resource');
	const URLUtils = require('dw/web/URLUtils');
	const Transaction = require('dw/system/Transaction');
	const BasketMgr = require('dw/order/BasketMgr');
	const HookMgr = require('dw/system/HookMgr');
	const iamportServices = require('*/cartridge/scripts/service/iamportService');
	const iamportHelpers = require('*/cartridge/scripts/helpers/iamportHelpers');
	const addressHelpers = require('*/cartridge/scripts/helpers/addressHelpers');
	const CustomError = require('*/cartridge/errors/customError');
	const reportingUrlsHelper = require('*/cartridge/scripts/reportingUrls');
    const OrderModel = require('*/cartridge/models/order');
    const Locale = require('dw/util/Locale');
	const customError;
	const paymentInformation = req.querystring;

	if (empty(paymentInformation) || !('imp_uid' in paymentInformation) || !('merchant_uid' in paymentInformation) || empty(paymentInformation.imp_uid) || empty(paymentInformation.merchant_uid)) {
		iamportLogger.error('GetConfirmation: query parameters must contain imp_uid {0} and merchant_uid {1}.', paymentInformation.imp_uid, paymentInformation.merchant_uid);
		res.redirect(URLUtils.url('Home-Show'));
		return next();
	}
	var orderID = paymentInformation.merchant_uid;
	var token = paymentInformation.token;
	var order = OrderMgr.getOrder(orderID, token);
	var paymentID = paymentInformation.imp_uid;
	var paymentData = iamportServices.getPaymentInformation.call({
		paymentID: paymentID
	});

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
	var lastOrderID = Object.prototype.hasOwnProperty.call(req.session.raw.custom, 'orderID') ? req.session.raw.custom.orderID : null;
	if (lastOrderID === orderID) {
		res.redirect(URLUtils.url('Home-Show'));
		return next();
	}

	if (('imp_success' in paymentInformation && paymentInformation.imp_success === 'true') || ('success' in paymentInformation && paymentInformation.success === 'true')) {
		var currentBasket = null;
		try {
			Transaction.wrap(function () {
				currentBasket = BasketMgr.createBasketFromOrder(order);
			});
		} catch (e) {
			iamportLogger.error(e.stack);
		}

		if (!currentBasket) {
			res.redirect(URLUtils.url('Cart-Show'));
			return next();
		}

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
			customError = new CustomError({ status: paymentData.getError() });

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

			var mappedPaymentInfo = iamportHelpers.mapVbankResponseForLogging(paymentData);
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

			var mappedPaymentInfo = iamportHelpers.mapPaymentResponseForLogging(paymentData);
			iamportLogger.debug('Payment Information: {0}.', JSON.stringify(mappedPaymentInfo));
		}

		res.setViewData({
			selectedPaymentMethod: order.custom.pay_method
		});

		if (!order || order.customer.ID !== req.currentCustomer.raw.ID) {
			res.render('/error', {
				message: Resource.msg('error.confirmation.error', 'confirmation', null)
			});

			return next();
		}
		var config = {
            numberOfLineItems: '*'
        };

        var currentLocale = Locale.getLocale(req.locale.id);

        var orderModel = new OrderModel(
            order,
            { config: config, countryCode: currentLocale.country, containerView: 'order' }
        );
        var passwordForm;

        var reportingURLs = reportingUrlsHelper.getOrderReportingURLs(order);

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
		return next();
	} else {
		var iamportErrorMessage = paymentInformation.error_msg;
		iamportLogger.error('Iamport server responded with an error: {0}.', iamportErrorMessage);

		COHelpers.recreateCurrentBasket(order,
			Resource.msg('order.note.payment.incomplete.subject', 'order', null),
			Resource.msg('order.note.payment.incomplete.body', 'order', null));

		res.redirect(URLUtils.url('Cart-Show', 'err', '02').toString());
		return next();
	}
});

module.exports = server.exports();
