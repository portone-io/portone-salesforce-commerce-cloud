'use strict';

const Logger = require('dw/system/Logger');
const Transaction = require('dw/system/Transaction');

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
		Logger.getLogger('Checkout', 'Paypal').error('Error on pyament "Handle" hook: {0}', e.message);
		result = {
			paymentInstrument: null,
			success: false,
			error: e
		};
	}
	return result;
}

/**
 * Constructs the payment information needed to request payment to Iamport server
 * @param {Object} order - Customer order data
 * @param {string} selectedPaymentMethod - Id of the selected payment method
 * @returns {Object} - The payment information
 */
function processPaymentInformation(order, selectedPaymentMethod) {
	let paymentInformation = {
		pg: order.billing.payment.iamportPaymentGateway.toString(),
		pay_method: selectedPaymentMethod,
		merchant_uid: 'ORD20180131-0000011',
		name: 'Norway swivel chair',
		amount: 100,
		buyer_email: 'johndoe@gmail.com',
		buyer_name: 'John Doe',
		buyer_tel: '010-4242-4242',
		buyer_addr: 'Shinsa-dong, Gangnam-gu, Seoul',
		buyer_postcode: '01181'
	};

	return paymentInformation;
}

module.exports = {
	processPaymentInformation: processPaymentInformation,
	processForm: processForm,
	Handle: Handle
};
