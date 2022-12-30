'use strict';

var server = require('server');
server.extend(module.superModule);
var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');
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

module.exports = server.exports();
