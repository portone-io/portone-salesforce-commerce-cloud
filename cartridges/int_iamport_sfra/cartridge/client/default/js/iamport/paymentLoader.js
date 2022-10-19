/* eslint-disable no-undef */

'use strict';

const deferLoader = require('../scripts/deferPayment');
const iamportUtilities = require('../scripts/utils/common');

const IAMPORT_ARGS = { MID: $('input[name="merchantID"]').val().toString().replace(/['"]+/g, '') };

/**
 * Send payment information to the server for validation
 *
 * @param {Object} paymentInformation - Payment information response upon payment request
 * @param {Object} paymentOptions - Additional payment information
 */
function sendPaymentInformation(paymentInformation, paymentOptions) {
	jQuery.ajax({
		url: paymentOptions.validationUrl,
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		data: paymentInformation,
		success: function (data) {
			let redirect = $('<form>')
				.appendTo(document.body)
				.attr({
					method: 'POST',
					action: data.continueUrl
				});

			$('<input>')
				.appendTo(redirect)
				.attr({
					name: 'orderID',
					value: data.orderID
				});

			$('<input>')
				.appendTo(redirect)
				.attr({
					name: 'orderToken',
					value: data.orderToken
				});

			redirect.submit();
		},
		error: function () {
			// enable the placeOrder button here
			$('body').trigger('checkout:enableButton', $('.next-step-button button'));
		}
	});
}

/**
 * Request payment to Iamport server using the payment information
 *
 * @param {string} item Iamport global object
 * @param {Object} paymentResources The payment resources
 * @param {string} validationUrl  the url to validate payment and place order
 */
const requestPayment = function requestPayment(item, paymentResources, validationUrl) {
	if (paymentResources) {
		let IMP = window[item];

		if (!IMP || !IAMPORT_ARGS.MID) {
			throw new Error('Merchant code not set');
		}

		IMP.init(IAMPORT_ARGS.MID);
		IMP.request_pay(paymentResources, function (paymentResponse) {
			let paymentOptions = {
				validationUrl: validationUrl
			};

			if (paymentResponse.success) {
				console.log('success');
				sendPaymentInformation({
					imp_uid: paymentResponse.imp_uid,
					merchant_uid: paymentResponse.merchant_uid
				}, paymentOptions);
			} else {
				// TODO: use a toast instead
				iamportUtilities.createErrorNotification(paymentResponse.error_msg);
			}

			// TODO: Test only; remove it later
			sendPaymentInformation({
				imp_uid: paymentResponse.imp_uid || '',
				merchant_uid: paymentResponse.merchant_uid || ''
			}, paymentOptions);
		});
	}
};

module.exports = {
	generalPayment: function (paymentResources, validationUrl) {
		try {
			$.spinner().start();
			deferLoader.defer('IMP', requestPayment, paymentResources, validationUrl);
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
