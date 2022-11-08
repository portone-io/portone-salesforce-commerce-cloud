'use strict';

const Cookie = require('dw/web/Cookie');
const iamportConstants = require('*/cartridge/constants/iamportConstants');
const Site = require('dw/system/Site');

/**
 * Prepares the payment resources needed to request payment to Iamport server
 * @param {Object} order - Customer order data
 * @param {string} selectedPaymentMethod - Id of the selected payment method
 * @returns {Object} - The payment resources
 */
function preparePaymentResources(order, selectedPaymentMethod) {
	let paymentInformation = {
		pg: Site.getCurrent().getCustomPreferenceValue(iamportConstants.PG_ATTRIBUTE_ID).value,
		pay_method: selectedPaymentMethod,
		amount: iamportConstants.TEST_AMOUNT
	};

	if (!paymentInformation.amount && order.totalNetPrice) {
		paymentInformation.amount = order.totalNetPrice.value;
	}

	if (order.orderNo) {
		paymentInformation.merchant_uid = order.orderNo;
	}

	if (order.customerName) {
		paymentInformation.name = order.customerName;
	}

	if (order.customerEmail) {
		paymentInformation.buyer_email = order.customerEmail;
	}

	if (order.billingAddress.address1) {
		paymentInformation.buyer_addr = order.billingAddress.address1;
	}

	if (order.billingAddress.phone) {
		paymentInformation.buyer_tel = order.billingAddress.phone;
	}

	if (order.billingAddress.fullName) {
		paymentInformation.buyer_name = order.billingAddress.fullName;
	}

	if (order.billingAddress.postalCode) {
		paymentInformation.buyer_postcode = order.billingAddress.postalCode;
	}

	return paymentInformation;
}

/**
 * Compares the actual amount paid to Iamport to the transaction amount
 * @param {Object} paymentData - Iamport payment data
 * @param {order} order - The order
 * @returns {boolean} - if fraud is detected
 */
function checkFraudPayments(paymentData, order) {
	return paymentData.object.response.amount
		!== order.paymentTransaction.amount.value;
}

/**
 * Maps the payment information from Iamport removing all sensitive data
 * @param {Object} paymentResponse - Payment Information from Iamport
 * @returns {Object} - Mapped payment information
 */
function mapPaymentResponseForLogging(paymentResponse) {
	return {
		paymentID: paymentResponse.getObject().response.imp_uid,
		orderID: paymentResponse.getObject().response.merchant_uid,
		paymentMethod: paymentResponse.getObject().response.pay_method,
		paymentGateway: paymentResponse.getObject().response.pg_provider,
		amountPaid: paymentResponse.getObject().response.amount,
		isEscrow: paymentResponse.getObject().response.escrow
	};
}

/**
 * Set the name of the selected payment method to cookies
 * @param {string} selectedPaymentMethod - Name of the selected payment method
 */
function setSelectedPaymentMethodToCookies(selectedPaymentMethod) {
	if (selectedPaymentMethod !== request.session.custom.pm) {
		let cookie = new Cookie('pm', selectedPaymentMethod);
		cookie.setDomain(['.', request.getHttpHost()].join(''));
		cookie.setPath('/');
		cookie.setMaxAge(365 * 86400);

		response.addHttpCookie(cookie);
	}
}

/**
 * Returns the correct error message from the Payment Gateway, or exactly the same message
 * @param {string} errorCode - Error code from the PG response
 * @param {string} errorMessage - Error message content from the PG response
 */
function handleErrorFromPaymentGateway(errorCode, errorMessage) {
	if (errorCode === 'NOT_READY') {
		return 'This user is not a registered user, or there is no PG information set on the Import Manager page.';
	}
	// This message from the PG response will be in korean. It should to be translated if
	return errorMessage;
}

module.exports = {
	preparePaymentResources: preparePaymentResources,
	checkFraudPayments: checkFraudPayments,
	mapPaymentResponseForLogging: mapPaymentResponseForLogging,
	setSelectedPaymentMethodToCookies: setSelectedPaymentMethodToCookies,
	handleErrorFromPaymentGateway: handleErrorFromPaymentGateway
};
