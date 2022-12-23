'use strict';

/**
 * fraud detection hook
 * @param {Object} paymentData - Response of payment
 * @param {dw.order.Order} order - The order object to be placed
 * @returns {Object} an error object. Status can have three values 'success', 'fail' or 'flag'
 *         error code that could be mapped to localized resources error Message a string with the
 *         error message, that could be used as a fall-back if error code doesn't have a mapping
 */
function fraudDetection(paymentData, order) { // eslint-disable-line
	const Resource = require('dw/web/Resource');
	var errorCode;
	var errorMessage;
	var status = 'success';
	var orderNo = order.orderNo;
	var paymentResponse = paymentData.object.response;
	// Converting to whole numbers as Korean currency does not support decimal numbers.
	var orderAmount = Number(order.totalGrossPrice.value.toFixed());
	if (paymentResponse.amount !== orderAmount || paymentResponse.merchant_uid !== orderNo) {
		status = 'fail';
		errorMessage = Resource.msg('message.error.fraud.detected', 'error', null);
		errorCode = 'fraud.detected';
	}

	return {
		status: status,
		errorCode: errorCode,
		errorMessage: errorMessage
	};
}

exports.fraudDetection = fraudDetection;
