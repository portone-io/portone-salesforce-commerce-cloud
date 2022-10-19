'use strict';

const iamportConstants = require('*/cartridge/constants/iamportConstants');
const Site = require('dw/system/Site');

/**
 * Prepares the payment information needed to request payment to Iamport server
 * @param {Object} order - Customer order data
 * @param {string} selectedPaymentMethod - Id of the selected payment method
 * @returns {Object} - The payment information
 */
function preparePaymentInformation(order, selectedPaymentMethod) {
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

module.exports = {
	preparePaymentInformation: preparePaymentInformation
};
