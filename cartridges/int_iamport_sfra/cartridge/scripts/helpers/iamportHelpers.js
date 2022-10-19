'use strict';


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
	processPaymentInformation: processPaymentInformation
};
