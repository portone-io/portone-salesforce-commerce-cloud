'use strict';

var base = require('base/paymentInstruments/paymentInstruments');
var iamportPayment = require('../iamport/iamport');
var notification = require('../iamport/notification');

base.addNewCard = function () {
	$('.btn-add-payment-card').on('click', function (e) {
		e.preventDefault();
		$.ajax({
			url: $(this).data('href'),
			success: function (data) {
				if (data.error) {
					notification({
						target: '.js-error-alert',
						message: data.errorMsg,
						classes: 'alert text-center',
						dismissTime: 5000
					});
				} else {
					iamportPayment.requestBillingKey(data);
				}
			},
			error: function (err) {
				window.location.reload();
			}
		});
	});
};

module.exports = base;
