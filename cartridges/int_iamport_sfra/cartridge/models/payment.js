'use strict';

var Site = require('dw/system/Site');
var IamportConstants = require('*/cartridge/constants/iamportConstants');
var pgValidators = require('*/cartridge/config/pgValidators');
var iamportLogger = require('dw/system/Logger').getLogger('iamport', 'Iamport');
var collections = require('*/cartridge/scripts/util/collections');

const basePayment = module.superModule;

/**
 * Creates an array of objects containing selected payment information
 * @param {dw.util.ArrayList<dw.order.PaymentInstrument>} selectedPaymentInstruments - ArrayList
 *      of payment instruments that the user is using to pay for the current basket
 * @returns {Array} Array of objects that contain information about the selected payment instruments
 */
function getSelectedPaymentInstruments(selectedPaymentInstruments) {
	return collections.map(selectedPaymentInstruments, function (paymentInstrument) {
		var results = {
			paymentMethod: paymentInstrument.paymentMethod,
			amount: paymentInstrument.paymentTransaction.amount.value
		};
		if (paymentInstrument.paymentMethod === 'CREDIT_CARD') {
			results.lastFour = paymentInstrument.creditCardNumberLastDigits;
			results.owner = paymentInstrument.creditCardHolder;
			results.expirationYear = paymentInstrument.creditCardExpirationYear;
			results.type = paymentInstrument.creditCardType;
			results.maskedCreditCardNumber = paymentInstrument.maskedCreditCardNumber;
			results.expirationMonth = paymentInstrument.creditCardExpirationMonth;
		} else if (paymentInstrument.paymentMethod === 'GIFT_CERTIFICATE') {
			results.giftCertificateCode = paymentInstrument.giftCertificateCode;
			results.maskedGiftCertificateCode = paymentInstrument.maskedGiftCertificateCode;
		} else if (paymentInstrument.paymentMethod === 'Iamport') {
			results.type = paymentInstrument.creditCardType ? paymentInstrument.creditCardType : '';
			results.maskedCreditCardNumber = paymentInstrument.creditCardNumber ? paymentInstrument.creditCardNumber : '';
		}

		return results;
	});
}

/**
 * Validate the selected payment methods against the actual ones specified in the PG validators
 *
 * @param {Array<dw.value.EnumValue>} selectedPaymentMethods - The selected payment methods in SitePreferences
 * @param {Array<Object>} actualPaymentMethods - The actual payment methods in the PG validators
 * @return {Array<Object>} - The valid payment methods
 */
function validatePaymentMethods(selectedPaymentMethods, actualPaymentMethods) {
	// eslint-disable-next-line array-callback-return, consistent-return
	let validPaymentMethods = selectedPaymentMethods.filter(function (selectedPaymentMethod) {
		let validPaymentMethod;

		for (let i = 0; i < actualPaymentMethods.length; i += 1) {
			let actualPaymentMethod = actualPaymentMethods[i];

			if (selectedPaymentMethod.value === actualPaymentMethod.id) {
				validPaymentMethod = selectedPaymentMethod;
				break;
			}
		}

		if (validPaymentMethod) {
			return validPaymentMethod;
		}
	});

	return validPaymentMethods;
}

/**
 * Retrieve payment methods supported by the specified payment gateway
 *
 * @param {string} paymentGatewayID - ID of the selected payment gateway
 * @returns {Array<Object>} - List of the payment methods
 */
function getPaymentMethods(paymentGatewayID) {
	let paymentGateway = pgValidators[paymentGatewayID];

	if (empty(paymentGateway)) {
		iamportLogger.error('No payment gateway was specified.');
	}

	let customSitePrefAttributes = Site.getCurrent().getPreferences().getCustom();
	let selectedPaymentMethods = customSitePrefAttributes[paymentGateway.paymentMethodsAttributeID];

	let actualPaymentMethods = paymentGateway.paymentMethods;
	let paymentMethods = validatePaymentMethods(selectedPaymentMethods, actualPaymentMethods);

	return paymentMethods;
}

/**
 * Payment class that represents payment information for the current basket
 * @param {dw.order.Basket} currentBasket - the target Basket object
 * @param {dw.customer.Customer} currentCustomer - the associated Customer object
 * @param {string} countryCode - the associated Site countryCode
 * @constructor
 */
function Payment(currentBasket, currentCustomer, countryCode) {
	basePayment.call(this, currentBasket, currentCustomer, countryCode);
	var paymentInstruments = currentBasket.paymentInstruments;

	let paymentGateway = Site.getCurrent().getCustomPreferenceValue(IamportConstants.PG_ATTRIBUTE_ID)
		|| IamportConstants.PG_DEFAULT_FALLBACK;

	this.selectedPaymentInstruments = paymentInstruments ? getSelectedPaymentInstruments(paymentInstruments) : null;

	this.iamportPaymentGateway = paymentGateway;
	this.iamportPaymentMethods = getPaymentMethods(paymentGateway);
}

module.exports = Payment;
