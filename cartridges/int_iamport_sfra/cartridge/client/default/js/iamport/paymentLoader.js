/* eslint-disable no-undef */

'use strict';

const deferLoader = require('../scripts/deferPayment');
const iamportUtilities = require('../scripts/utils/index');
const IAMPORT_ARGS = { MID: $('input[name="merchantID"]').val()
	.toString().replace(/['"]+/g, '') };

/**
 * Send payment information to the server for validation
 *
 * @param {Object} paymentResponse - Payment response upon payment request
 * @param {Object} paymentOptions - Additional payment information
 * @param {Object} paymentOptions.validationUrl - Url for payment post validation
 */
function sendPaymentInformation(paymentResponse, paymentOptions) {
	let defer = $.Deferred(); // eslint-disable-line

	$.ajax({
		url: paymentOptions.validationUrl,
		method: 'POST',
		data: paymentResponse,
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
 * @param {Object} paymentResources - Payment response upon payment request
 * @param {Object} paymentOptions - Additional payment information
 * @param {Object} paymentOptions.cancelUrl - Url for handling payment failure cases
 */
function handlePaymentFailure(paymentResources, paymentOptions) {
	let defer = $.Deferred(); // eslint-disable-line

	$.ajax({
		url: paymentOptions.cancelUrl,
		method: 'POST',
		data: {
			merchant_uid: paymentResources.merchant_uid,
			imp_uid: paymentResources.imp_uid,
			errorMsg: paymentResources.error_msg,
			orderToken: paymentOptions.orderToken
		},
		success: function (data) {
			defer.reject();
			window.location.href = data.redirectUrl;
		},
		error: function (error) {
			defer.reject();
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
				sendPaymentInformation(paymentResponse, paymentOptions);
			} else {
				// handle payment failure
				handlePaymentFailure(paymentResponse, paymentOptions);
			}
		});
	}
};

module.exports = {
	generalPayment: function (payload) {
		try {
			$.spinner().start();

			if (payload) {
				deferLoader.defer('IMP', requestPayment, payload);
			}
		} catch (err) {
			// TODO: handle iamport errors. Send the error to the backend logs
			// eslint-disable-next-line no-console
			console.log(err);
		} finally {
			$.spinner().stop();
		}
	},

	// Render the selected payment method
	renderSelectedPaymentMethod: function () {
		$('.iamport-payment-method-name span')
			.html(iamportUtilities.getCookie('pm')
			.toString().replace(/['"]+/g, ''));
	}
};
