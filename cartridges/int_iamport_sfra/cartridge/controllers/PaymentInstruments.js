'use strict';

var server = require('server');
server.extend(module.superModule);
var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');
var iamportLogger = require('dw/system/Logger').getLogger('iamport', 'Iamport');

/**
 * PaymentInstruments-DeletePayment : The PaymentInstruments-DeletePayment is the endpoint responsible for deleting a shopper's saved payment instrument from their account
 * @name Base/PaymentInstruments-DeletePayment
 * @function
 * @memberof PaymentInstruments
 * @param {middleware} - userLoggedIn.validateLoggedInAjax
 * @param {querystringparameter} - UUID - the universally unique identifier of the payment instrument to be removed from the shopper's account
 * @param {category} - sensitive
 * @param {returns} - json
 * @param {serverfunction} - get
 */
server.append('DeletePayment', userLoggedIn.validateLoggedInAjax, function (req, res, next) {
	var array = require('*/cartridge/scripts/util/array');
	var iamportServices = require('*/cartridge/scripts/service/iamportService');
	var UUID = req.querystring.UUID;
	var paymentInstruments = req.currentCustomer.wallet.paymentInstruments;
	var paymentToDelete = array.find(paymentInstruments, function (item) {
		return UUID === item.UUID;
	});
	if (paymentToDelete && paymentToDelete.raw.creditCardToken) {
		var token = paymentToDelete.raw.creditCardToken;
		// It is use to delete the subscribe payment from my account.
		var paymentResponse = iamportServices.deleteSubscribePayment.call({
			customerUid: token
		});
		if (!paymentResponse.isOk() || paymentResponse.getObject().message) {
			var iamportResponseError = '';
			if (paymentResponse.errorMessage) {
				iamportResponseError = JSON.parse(paymentResponse.errorMessage);
			} else if (paymentResponse.getObject().message) {
				iamportResponseError = paymentResponse.getObject().message;
			}
			iamportLogger.error('Delete Subscibe Payment request failed: {0}.', JSON.stringify(iamportResponseError));
		}
	}
	next();
});

/**
 * PaymentInstruments-ListCardsForMobile : The endpoint PaymentInstruments-ListCardsForMobile is call from Iamport Server to display customer saved credit cards for mobile
 * @name Custom/PaymentInstruments-ListCardsForMobile
 * @function
 * @memberof PaymentInstruments
 * @param {middleware} - userLoggedIn.validateLoggedIn
 * @param {middleware} - consentTracking.consent
 * @param {category} - sensitive
 * @param {renders} - isml
 * @param {serverfunction} - get
 */
server.get('ListCardsForMobile', userLoggedIn.validateLoggedIn, consentTracking.consent, function (req, res, next) {
	var iamportServices = require('*/cartridge/scripts/service/iamportService');
	var iamportHelpers = require('*/cartridge/scripts/helpers/iamportHelpers');
	var URLUtils = require('dw/web/URLUtils');
	var Resource = require('dw/web/Resource');
	var AccountModel = require('*/cartridge/models/account');
	var parameters = req.querystring;
	var paymentId = parameters.imp_uid;
	var success = parameters.imp_success;
	var merchantUid = parameters.merchant_uid;
	var customerUid = '';
	// not allow to customer hit the same endpoint after saved the card details.
	var lastPaymentId = Object.prototype.hasOwnProperty.call(req.session.raw.custom, 'paymentId') ? req.session.raw.custom.paymentId : null;
	if (lastPaymentId === paymentId) {
		res.redirect(URLUtils.url('PaymentInstruments-List'));
		return next();
	}
	if (success === 'true') {
		var paymentData = iamportServices.getPaymentInformation.call({
			paymentID: paymentId
		});
		if (paymentData.isOk() && paymentData.getObject().message == null) {
			var response = paymentData.getObject().response;
			var responseMerchantId = response.merchant_uid;
			customerUid = response.customer_uid;
			if (merchantUid === responseMerchantId) {
				// Make auth payment with the saved billing key to get credit card detials and save card details in wallet for mobile.
				iamportHelpers.handleSubcribePaymentRequest(req, customerUid);
				req.session.raw.custom.paymentId = paymentId;
			}
		}
	}

	var paymentInstruments = AccountModel.getCustomerPaymentInstruments(
		req.currentCustomer.wallet.paymentInstruments
	);

	res.render('account/payment/payment', {
		paymentInstruments: paymentInstruments,
		noSavedPayments: paymentInstruments.length === 0,
		actionUrl: URLUtils.url('PaymentInstruments-DeletePayment').toString(),
		addPaymentUrl: URLUtils.url('PaymentInstruments-AddPayment').toString(),
		breadcrumbs: [
			{
				htmlValue: Resource.msg('global.home', 'common', null),
				url: URLUtils.home().toString()
			},
			{
				htmlValue: Resource.msg('page.title.myaccount', 'account', null),
				url: URLUtils.url('Account-Show').toString()
			}
		]
	});

	return next();
});

module.exports = server.exports();
