/* eslint-disable no-undef */

'use strict';

const deferLoader = require('../scripts/deferPayment');
const iamportUtilities = require('../scripts/utils/common');

const PAYMENT_ARGS = { MID: $('input[name="merchantID"]').val().toString() };
const IMPORT_PAYMENT_INFO = JSON.parse($('input[name="paymentInformation"]').val());

const requestPayment = function (item, args) {
	if (IMPORT_PAYMENT_INFO) {
		let IMP = window[item];

		if (!IMP || !args.MID) {
			throw new Error('Merchant code not set');
		}

		IMP.init(args.MID);
		IMP.request_pay(IMPORT_PAYMENT_INFO, function (paymentResponse) {
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
	generalPayment: function () {
		try {
			$.spinner().start();
			deferLoader.defer('IMP', requestPayment, PAYMENT_ARGS);
		} catch (err) {
			// TODO: handle errors with meaningful error messages
			iamportUtilities.createErrorNotification(err.message);
		} finally {
			$.spinner().stop();
		}
	}
};
