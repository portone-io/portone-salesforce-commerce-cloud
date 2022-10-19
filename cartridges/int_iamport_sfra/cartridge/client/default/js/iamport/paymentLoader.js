/* eslint-disable no-undef */

'use strict';

const deferLoader = require('../scripts/deferPayment');
const iamportUtilities = require('../scripts/utils/common');

const IAMPORT_ARGS = { MID: $('input[name="merchantID"]').val().toString() };

/**
 * Request payment to Iamport server using the payment information
 *
 * @param {*} item Iamport global object
 * @param {*} paymentInformation The payment information
 */
const requestPayment = function requestPayment(item, paymentInformation) {
	if (paymentInformation) {
		let IMP = window[item];

		if (!IMP || !IAMPORT_ARGS.MID) {
			throw new Error('Merchant code not set');
		}

		IMP.init(IAMPORT_ARGS.MID);
		IMP.request_pay(paymentInformation, function (paymentResponse) {
			if (paymentResponse.success) {
				// success
			} else {
				// TODO: use a toast instead
				iamportUtilities.createErrorNotification(paymentResponse.error_msg);
			}
		});
	}
};

module.exports = {
	generalPayment: function (paymentInformation) {
		try {
			$.spinner().start();
			deferLoader.defer('IMP', requestPayment, paymentInformation);
		} catch (err) {
			// TODO: handle errors with meaningful error messages
			iamportUtilities.createErrorNotification(err.message);
		} finally {
			$.spinner().stop();
		}
	},

	handlePaymentMethodSelection: function () {
		$('body').on('click', '.payment-method', function () {
			//
		});
	},

	// Get the selected payment method
	getSelectedPaymentMethod: function () {
		let paymentMethods = $('.payment-method');
		let selectedPaymentMethod = '';

		for (let i = 0; i < paymentMethods.length; i++) {
			let paymentMethod = paymentMethods[i];

			if (paymentMethod.checked) {
				selectedPaymentMethod = paymentMethod.value;
			}
		}

		return selectedPaymentMethod;
	}
};
