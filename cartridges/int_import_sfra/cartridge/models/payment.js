'use strict';

const Site = require('dw/system/Site');
const IamportConstants = require('*/cartridge/constants/iamportConstants');
const pgMapping = require('*/cartridge/config/pgMapping');

const basePayment = module.superModule;

/**
 * 
 * @param {*} paymentGateway 
 * @param {*} paymentMethod 
 */
function validatePaymentMethods() {

}

/**
 * Retrieve payment methods supported by the specified payment gateway
 *
 * @returns {Array<Object>} - List of the payment methods
 */
function getPaymentMethods() {
	let pgMap = pgMapping[this.iamportPaymentGateway];
	let actualPaymentMethods = pgMap.paymentMethods;

	let selectedPaymentMethods = Site.getCurrent().getCustomPreferenceValue(IamportConstants.);
	
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
		|| IamportConstants.PG_FALLBACK;

	this.iamportPaymentGateway = paymentGateway;
	this.iamportPaymentMethods = getPaymentMethods();
}

module.exports = Payment;
