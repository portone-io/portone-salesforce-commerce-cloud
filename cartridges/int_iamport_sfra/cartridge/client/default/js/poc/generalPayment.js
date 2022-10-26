/* eslint-disable no-undef */
'use strict';

const deferLoader = require('../scripts/deferPayment');
const IAMPORT_ARGS = { MID: $('input[name="merchantID"]').val()
	.toString().replace(/['"]+/g, '') };


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

// POC only TODO: Remove
const testPOCPayment = function (testPaymentResources, testValidationUrl) {
	deferLoader.defer('IMP', function (item, paymentResources, validationUrl) {
		if (paymentResources) {
			let IMP = window[item];
			if (!IMP || !IAMPORT_ARGS.MID) {
				throw new Error('Merchant code not set');
			}

			IMP.init(IAMPORT_ARGS.MID);
			IMP.request_pay(paymentResources, function (paymentResponse) {
				// if payment is successful, or failed
				let paymentOptions = { validationUrl: validationUrl };
				sendPaymentInformation({
					imp_uid: 'imp_566377906932',
					merchant_uid: '00001002'
				}, paymentOptions);
			});
		}
	}, testPaymentResources, testValidationUrl);
};

module.exports = {
	// For Testing POC TODO: Remove
	testPOC: function () {
		$('body').on('click', '.test-poc', function (e) {
			let url = $('.test-poc').data('url');

			$.ajax({
				url: url,
				method: 'POST',
				success: function (data) {
					if (data.paymentResources) {
						testPOCPayment(data.paymentResources, data.validationUrl);
					}
				},
				error: function (err) {
					// TODO: Remove log
					// eslint-disable-next-line no-console
					console.log(err);
				}
			});
		});
	}
};
