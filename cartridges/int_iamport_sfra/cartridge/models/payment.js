'use strict';

const Site = require('dw/system/Site');
const IamportConstants = require('*/cartridge/constants/iamportConstants');
const pgValidators = require('*/cartridge/config/pgValidators');
const Logger = require('dw/system/Logger').getLogger('iamport', 'Iamport');

const basePayment = module.superModule;

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
		Logger.error('No payment gateway was specified');
	}

	let customSitePrefAttributes = Site.getCurrent().getPreferences().getCustom();
	let selectedPaymentMethods = customSitePrefAttributes[paymentGateway.paymentMethodsAttributeID];

	let actualPaymentMethods = paymentGateway.paymentMethods;
	let paymentMethods = validatePaymentMethods(selectedPaymentMethods, actualPaymentMethods);

	return paymentMethods;
}

/**
 * Extend the payment instrument with the payment option from the storefront payment method selection
 *
 * @param {Array<Object>} paymentInstruments - List of payment instruments
 * @param {string} paymentOption - Iamport payment option chosen on the storefront
 * @returns {Array<Object>} Payment instrument with the payment option parameter
 */
function extendPaymentInstrument(paymentInstruments, paymentOption) {
	let results = [];

	paymentInstruments.forEach(function (paymentInstrument) {
		let result = paymentInstrument;

		if (paymentInstrument.paymentMethod === 'Iamport') {
			result.paymentOption = paymentOption;
		}
		results.push(result);
	});

	return results;
}

/**
 * Payment class that represents payment information for the current basket
 * @param {dw.order.Basket} currentBasket - the target Basket object
 * @param {dw.customer.Customer} currentCustomer - the associated Customer object
 * @param {string} countryCode - the associated Site countryCode
 * @param {string} paymentOption - Iamport payment option
 * @constructor
 */
function Payment(currentBasket, currentCustomer, countryCode, paymentOption) {
	basePayment.call(this, currentBasket, currentCustomer, countryCode);

	let paymentInstruments = this.selectedPaymentInstruments;
	this.selectedPaymentInstruments = paymentInstruments && paymentOption
		? extendPaymentInstrument(paymentInstruments, paymentOption) : null;

	let paymentGateway = Site.getCurrent().getCustomPreferenceValue(IamportConstants.PG_ATTRIBUTE_ID)
		|| IamportConstants.PG_DEFAULT_FALLBACK;

	this.iamportPaymentGateway = paymentGateway;
	this.iamportPaymentMethods = getPaymentMethods(paymentGateway);
}

module.exports = Payment;
