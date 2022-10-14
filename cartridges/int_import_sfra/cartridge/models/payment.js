'use strict';

const Site = require('dw/system/Site');
const IamportConstants = require('*/cartridge/constants/iamportConstants');
const pgValidators = require('*/cartridge/config/pgValidators');

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

	TODO: // Use logger here
	if (empty(paymentGateway)) return [];

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

	let paymentGateway = Site.getCurrent().getCustomPreferenceValue(IamportConstants.PG_ATTRIBUTE_ID)
		|| IamportConstants.PG_DEFAULT_FALLBACK;

	this.iamportPaymentGateway = paymentGateway;
	this.iamportPaymentMethods = getPaymentMethods(paymentGateway);
}

module.exports = Payment;
