'use strict';

const Logger = require('dw/system/Logger');
const Transaction = require('dw/system/Transaction');
const Resource = require('dw/web/Resource');

/**
 * Iamport hook form processor
 * @param {Object} req - The request object
 * @param {Object} paymentForm - the payment form
 * @param {Object} viewFormData - object contains billing form data
 * @returns {Object} an object that has error information or payment information
 */
function processForm(req, paymentForm, viewFormData) {
	viewFormData.paymentMethod = {
		value: paymentForm.paymentMethod.value,
		htmlName: paymentForm.paymentMethod.value
	};

	return {
		viewData: viewFormData,
		success: true,
		error: false
	};
}


/**
 * Handle entry point for Iamport integration
 * @param {dw.order.Basket} basket Current users's basket
 * @param {Object} paymentInformation - the payment information
 * @param {string} paymentMethodID - payment method id
 * @param {Object} req the request object
 * @returns {Object} processor result
 */
function Handle(basket, paymentInformation, paymentMethodID, req) {
	let result;

	try {
		result = Transaction.wrap(function () {
			let paymentInstrument;
			if (empty(basket.getPaymentInstruments(paymentMethodID))) {
				paymentInstrument = basket.createPaymentInstrument(
					paymentMethodID,
					basket.getTotalGrossPrice()
				);
			} else {
				paymentInstrument = basket.getPaymentInstruments(paymentMethodID);
			}

			return {
				paymentInstrument: paymentInstrument,
				success: true,
				error: false
			};
		});
	} catch (e) {
		Logger.getLogger('Checkout', 'Paypal').error('Error on payment "Handle" hook: {0}', e.message);
		result = {
			paymentInstrument: null,
			success: false,
			error: e
		};
	}
	return result;
}


/**
 * Authorizes a payment using PayPal Plus
 * @param {number} orderNumber - The current order's number
 * @param {dw.order.PaymentInstrument} paymentInstrument -  The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor -  The payment processor of the current
 *      payment method
 * @return {Object} returns an error object
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
	let serverErrors = [];
	let fieldErrors = {};
	let error = false;

	try {
		Transaction.wrap(function () {
			paymentInstrument.paymentTransaction.setTransactionID(orderNumber);
			paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);
		});
	} catch (e) {
		error = true;
		serverErrors.push(
			Resource.msg('error.technical', 'checkout', null)
		);
	}

	return { fieldErrors: fieldErrors, serverErrors: serverErrors, error: error };
}

module.exports = {
	processForm: processForm,
	Handle: Handle,
	Authorize: Authorize
};
