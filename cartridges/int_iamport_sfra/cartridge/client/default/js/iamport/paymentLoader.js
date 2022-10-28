/* eslint-disable no-undef */

'use strict';

const deferLoader = require('../scripts/deferPayment');
const iamportUtilities = require('../scripts/utils/common');
const IAMPORT_ARGS = { MID: $('input[name="merchantID"]').val()
	.toString().replace(/['"]+/g, '') };

/**
 * Send payment information to the server for validation
 *
 * @param {Object} paymentInformation - Payment information response upon payment request
 * @param {Object} paymentOptions - Additional payment information
 */
function sendPaymentInformation(paymentInformation, paymentOptions) {
	$.ajax({
		url: paymentOptions.validationUrl,
		method: 'POST',
		data: paymentInformation,
		success: function (data) {
			if (data.error) {
				if (data.cartError) {
					window.location.href = data.redirectUrl;
					defer.reject();
				} else {
					// go to appropriate stage and display error message
					defer.reject(data);
				}
			} else {
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
				defer.resolve(data);
			}
		},
		error: function () {
			// enable the placeOrder button here
			$('body').trigger('checkout:enableButton', $('.next-step-button button'));
		}
	});
}

/**
 * Send payment information to the server for validation
 *
 * @param {Object} paymentInformation - Payment information response upon payment request
 * @param {Object} paymentOptions - Additional payment information
 * @param {Object} paymentOptions.validationUrl - Url for payment post validation
 * @param {Object} paymentOptions.cancelUrl - Url for handling payment failure cases
 */
function handlePaymentFailure(paymentInformation, paymentOptions) {
	$.ajax({
		url: paymentOptions.cancelUrl,
		method: 'POST',
		data: {
			paymentInformation: paymentInformation,
			orderToken: paymentOptions.orderToken
		},
		success: function (data) {
			window.location.href = data.redirectUrl;
			defer.reject();
		},
		error: function (error) {
			//
		}
	});
}

/**
 * Request payment to Iamport server using the payment information
 *
 * @param {string} item Iamport global object
 * @param {Object} paymentPayload The payment resources
 */
const requestPayment = function requestPayment(item, paymentPayload) {
	if (paymentPayload.paymentResources) {
		let IMP = window[item];
		if (!IMP || !IAMPORT_ARGS.MID) {
			throw new Error('Merchant code not set');
		}

		IMP.init(IAMPORT_ARGS.MID);
		IMP.request_pay(paymentPayload.paymentResources, function (paymentResponse) {
			let paymentOptions = {
				validationUrl: paymentPayload.validationUrl,
				cancelUrl: paymentPayload.cancelUrl,
				orderToken: paymentPayload.orderToken
			};

			if (paymentResponse.success) {
				// TODO: Remove log
				// eslint-disable-next-line no-console
				console.log('success');
				sendPaymentInformation({
					imp_uid: paymentResponse.imp_uid,
					merchant_uid: paymentResponse.merchant_uid
				}, paymentOptions);
			} else {
				// handle payment failure
				handlePaymentFailure({
					imp_uid: paymentResponse.imp_uid,
					merchant_uid: paymentResponse.merchant_uid
				}, paymentOptions);
			}

			// POC only TODO: Remove
			sendPaymentInformation({
				imp_uid: paymentResponse.imp_uid || '',
				merchant_uid: paymentResponse.merchant_uid || ''
			}, paymentOptions);
		});
	}
};

module.exports = {
	generalPayment: function (payload) {
		try {
			$.spinner().start();
			deferLoader.defer('IMP', requestPayment, paymentPayload);
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
