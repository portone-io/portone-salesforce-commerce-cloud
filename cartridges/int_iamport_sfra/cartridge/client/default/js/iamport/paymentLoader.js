/* eslint-disable no-undef */

'use strict';

const deferLoader = require('../scripts/deferPayment');
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
	var defer = $.Deferred(); // eslint-disable-line

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
				// Pass Get Request on order confirmation page for SFRA 5
				if ($('input[name="sfra5Enabled"]').val() === 'true') {
					var continueUrl = data.continueUrl;
					var urlParams = {
						ID: data.orderID,
						token: data.orderToken
					};

					continueUrl += (continueUrl.indexOf('?') !== -1 ? '&' : '?') +
						Object.keys(urlParams).map(function (key) {
							return key + '=' + encodeURIComponent(urlParams[key]);
						}).join('&');

					window.location.href = continueUrl;
				} else {
					// Pass Post Request on order confirmation page for SFRA 6
					var redirect = $('<form>'
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

					if (data.vbank) {
						$('<input>')
						.appendTo(redirect)
						.attr({
							name: 'vbank',
							value: data.vbank
						});

						for (var vbankPayloadKey in data.vbankPayload) {
							$('<input>')
							.appendTo(redirect)
							.attr({
								name: vbankPayloadKey,
								value: data.vbankPayload[vbankPayloadKey]
							});
						}
					}
					redirect.submit();
				}
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
	var defer = $.Deferred(); // eslint-disable-line

	if (paymentResources.error_code || paymentResources.paymentError) {
		// If there is an error code in the response, the cancellation belongs from a bad request, and the PG popup couldn't be opened. Executes requestPayFailureUrl method
		$.ajax({
			url: paymentOptions.requestPayFailureUrl,
			method: 'POST',
			data: {
				merchant_uid: paymentOptions.merchant_uid,
				imp_uid: paymentResources.imp_uid,
				orderToken: paymentOptions.orderToken,
				errorMsg: paymentResources.error_msg,
				errorCode: paymentResources.error_code,
				status: paymentOptions.status
			},
			success: function (data) {
				defer.reject();
				window.location.href = data.redirectUrl;
			},
			error: function (error) {
				defer.reject();
			}
		});
	} else {
		// If there is not any error code in the response, the cancellation belongs from the popup (User cancelled the payment form the popup)
		$.ajax({
			url: paymentOptions.cancelUrl,
			method: 'POST',
			data: {
				merchant_uid: paymentResources.merchant_uid,
				imp_uid: paymentResources.imp_uid,
				orderToken: paymentOptions.orderToken,
				errorMsg: paymentResources.error_msg,
				errorCode: paymentResources.error_code,
				status: paymentOptions.status,
				pg_type: paymentResources.pg_type,
				success: paymentResources.success
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
}

/**
 * Request payment to Iamport server using the payment information
 *
 * @param {string} item Iamport global object
 * @param {Object} paymentPayload The payment resources
 */
const requestPayment = function requestPayment(item, paymentPayload) {
	if (paymentPayload.paymentResources) {
		var IMP = window[item];
		if (!IMP || !IAMPORT_ARGS.MID) {
			throw new Error('Merchant code not set');
		}


		IMP.init(IAMPORT_ARGS.MID);

		IMP.request_pay(paymentPayload.paymentResources, function (paymentResponse) {
			var paymentOptions = {
				validationUrl: paymentPayload.validationUrl,
				cancelUrl: paymentPayload.cancelUrl,
				orderToken: paymentPayload.orderToken,
				requestPayFailureUrl: paymentPayload.requestPayFailureUrl,
				merchant_uid: paymentPayload.merchantID
			};

			if (paymentResponse.success) {
				sendPaymentInformation(paymentResponse, paymentOptions);
			} else {
				// You have to comment this line of code out to simulate a successful payment
				handlePaymentFailure(paymentResponse, paymentOptions);
			}

			// TODO: remove this line of code.
			// This line is just for testing purposes.
			// Since we cannot make a successful payment always, this line is used to
			// simulate a successful payment no matter the outcome of the payment
			// sendPaymentInformation(paymentResponse, paymentOptions);
		});
	}
};

const handlePaymentError = function handlePaymentError(item, paymentPayload) {
	if (paymentPayload.paymentError) {
		var paymentOptions = {
			orderToken: paymentPayload.orderToken,
			requestPayFailureUrl: paymentPayload.requestPayFailureUrl,
			merchant_uid: paymentPayload.merchantID
		};
		handlePaymentFailure(paymentPayload.paymentResources, paymentOptions);
	}
};

module.exports = {
	generalPayment: function (payload) {
		try {
			if (payload && payload.paymentError) {
				deferLoader.defer('IMP', handlePaymentError, payload);
			} else if (payload) {
				deferLoader.defer('IMP', requestPayment, payload);
			}
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('Error on the request calling to PG server:', err);
		}
	},

	// Render the selected payment method
	renderSelectedPaymentMethod: function (selectedPaymentMethod) {
		if (selectedPaymentMethod) {
			var paymentMethod = selectedPaymentMethod.toString().replace(/['"]+/g, '');
			$('.iamport-payment-method-name').empty().html('<span>' + paymentMethod + '</span>');
		}
	}
};
