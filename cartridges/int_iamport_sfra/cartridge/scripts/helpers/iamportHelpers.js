'use strict';

const Resource = require('dw/web/Resource');
const iamportConstants = require('*/cartridge/constants/iamportConstants');
const Site = require('dw/system/Site');

/**
 * Prepares the payment resources needed to request payment to Iamport server
 * @param {Object} order - Customer order data
 * @param {string} selectedPaymentMethod - Id of the selected payment method
 * @param {string} noticeUrl - webhook receive URL. Default is undefined
 * @returns {Object} - The payment resources
 */
function preparePaymentResources(order, selectedPaymentMethod, noticeUrl) {
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

	if (noticeUrl) {
		paymentInformation.notice_url = noticeUrl;
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
 * @param {Object} paymentData - Payment Information from Iamport
 * @returns {Object} - Mapped payment information
 */
function mapPaymentResponseForLogging(paymentData) {
	let paymentResponse = paymentData.getObject().response;
	return {
		paymentID: paymentResponse.imp_uid,
		orderID: paymentResponse.merchant_uid,
		paymentMethod: paymentResponse.pay_method,
		paymentGateway: paymentResponse.pg_provider,
		amountPaid: paymentResponse.amount,
		isEscrow: paymentResponse.escrow
	};
}

/**
 * Maps the virtual account information from Iamport
 * @param {Object} paymentData - Payment Information from Iamport
 * @returns {Object} - Mapped payment information
 */
function mapVbankResponseForLogging(paymentData) {
	let paymentResponse = paymentData.getObject().response;

	return Object.assign(mapPaymentResponseForLogging(paymentData), {
		vbankName: paymentResponse.vbank_name,
		vbankNumber: paymentResponse.vbank_num,
		vbankExpiration: paymentResponse.vbank_date,
		vbankCode: paymentResponse.vbank_code,
		vbankIssuedAt: paymentResponse.vbank_issued_at,
		vbankHolder: paymentResponse.vbank_holder
	});
}

/**
 * Returns the correct error message from the Payment Gateway, or exactly the same message
 * @param {string} errorCode - Error code from the PG response
 * @param {string} errorMessage - Error message content from the PG response
 * @return {string} - Error message
 */
function handleErrorFromPaymentGateway(errorCode, errorMessage) {
	if (errorCode === 'NOT_READY') {
		return Resource.msg('payment.gateway.error', 'iamport', null);
	}
	// This message from the PG response will be in korean. It should to be translated if
	return errorMessage;
}

module.exports = {
	preparePaymentResources: preparePaymentResources,
	checkFraudPayments: checkFraudPayments,
	mapPaymentResponseForLogging: mapPaymentResponseForLogging,
	mapVbankResponseForLogging: mapVbankResponseForLogging,
	handleErrorFromPaymentGateway: handleErrorFromPaymentGateway
};
