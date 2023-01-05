'use strict';
var base = module.superModule;
var URLUtils = require('dw/web/URLUtils');
var Customer = require('dw/customer/Customer');

/**
 * Creates a plain object that contains payment instrument information with custom attributes
 * @param {Object} wallet - current customer's wallet
 * @returns {Object} object that contains info about the current customer's payment instrument
 */
function getPayment(wallet) {
	if (wallet) {
		var paymentInstruments = wallet.paymentInstruments;
		if (paymentInstruments && paymentInstruments.length > 0) {
			var paymentInstrument = paymentInstruments[0];
			var paymentObj = 'raw' in paymentInstrument ? paymentInstrument.raw : paymentInstrument;
			return {
				maskedCreditCardNumber: paymentInstrument.maskedCreditCardNumber,
				creditCardType: paymentInstrument.creditCardType,
				creditCardExpirationMonth: paymentInstrument.creditCardExpirationMonth,
				creditCardExpirationYear: paymentInstrument.creditCardExpirationYear,
				iamportCreditCardNumber: 'iamportCreditCardNumber' in paymentObj.custom ? paymentObj.custom.iamportCreditCardNumber : '',
				iamportCreditCardPG: 'iamportCreditCardPG' in paymentObj ? paymentObj.custom.iamportCreditCardPG : ''
			};
		}
	}
	return null;
}

/**
 * Creates a plain object that contains payment instrument information with custom attributes
 * @param {Object} userPaymentInstruments - current customer's paymentInstruments
 * @returns {Object} object that contains info about the current customer's payment instruments
 */
function getCustomerPaymentInstruments(userPaymentInstruments) {
	var paymentInstruments;

	paymentInstruments = userPaymentInstruments.map(function (paymentInstrument) {
		var paymentObj = 'raw' in paymentInstrument ? paymentInstrument.raw : paymentInstrument;
		var result = {
			creditCardHolder: paymentInstrument.creditCardHolder,
			maskedCreditCardNumber: paymentInstrument.maskedCreditCardNumber,
			creditCardType: paymentInstrument.creditCardType,
			creditCardExpirationMonth: paymentInstrument.creditCardExpirationMonth,
			creditCardExpirationYear: paymentInstrument.creditCardExpirationYear,
			UUID: paymentInstrument.UUID,
			iamportCreditCardNumber: 'iamportCreditCardNumber' in paymentObj.custom ? paymentObj.custom.iamportCreditCardNumber : '',
			iamportCreditCardPG: 'iamportCreditCardPG' in paymentObj ? paymentObj.custom.iamportCreditCardPG : ''
		};

		result.cardTypeImage = {
			src: URLUtils.staticURL('/images/' +
				paymentInstrument.creditCardType.toLowerCase().replace(/\s/g, '') +
				'-dark.svg'),
			alt: paymentInstrument.creditCardType
		};

		return result;
	});

	return paymentInstruments;
}

/**
 * override this module to get paymentInstruments custom attributes.
 * @param {dw.customer.Customer} currentCustomer - Current customer
 * @param {Object} addressModel - The current customer's preferred address
 * @param {Object} orderModel - The current customer's order history
 * @constructor
 */
function account(currentCustomer, addressModel, orderModel) {
	base.call(this, currentCustomer, addressModel, orderModel);
	this.payment = getPayment(currentCustomer instanceof Customer ? currentCustomer.profile.wallet : currentCustomer.wallet);
}

account.getCustomerPaymentInstruments = getCustomerPaymentInstruments;

module.exports = account;
