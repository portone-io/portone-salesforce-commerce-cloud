'use strict';

var IAMPORT_ARGS = { MID: $('input[name="merchantID"]').val()
	.toString().replace(/['"]+/g, '') };
var notification = require('../iamport/notification');

/**
 *
 * @param {string} item pass IMP in window request
 * @param {Object} paymentPayload request for get billing key
 */
function requestSubscriptionPayment(item, paymentPayload) {
	var IMP = window[item];
	if (!IMP || !IAMPORT_ARGS.MID) {
		throw new Error('Merchant code not set');
	}
	IMP.init(IAMPORT_ARGS.MID);
	IMP.request_pay(paymentPayload.paymentResources, function (paymentResponse) {
		if (paymentResponse.success) {
			$.ajax({
				url: paymentPayload.validationUrl,
				method: 'POST',
				data: paymentResponse,
				success: function (data) {
					if (data.error) {
						notification({
							target: '.js-error-alert',
							message: data.errorMsg,
							classes: 'alert text-center',
							dismissTime: 5000
						});
					} else {
						window.location.href = data.redirectUrl;
					}
				},
				error: function () {
					window.location.reload();
				}
			});
		} else if (paymentResponse.error_code !== 'STOP') {
			// Error occurred before page is redirected
			notification({
				target: '.js-error-alert',
				message: paymentResponse.error_msg,
				classes: 'alert text-center',
				dismissTime: 5000
			});
		}
	});
}

module.exports = {
	// Request billing key
	requestBillingKey: function (paymentPayload) {
		try {
			requestSubscriptionPayment('IMP', paymentPayload);
		} catch (err) {
			// eslint-disable-next-line no-console
			window.location.reload();
		} finally {
			$.spinner().stop();
		}
	}
};
