'use strict';

var base = require('base/paymentInstruments/paymentInstruments');
var iamportPayment = require('../iamport/iamport');


base.addNewCard = function () {
	$('.btn-add-payment-card').on('click', function (e) {
		e.preventDefault();
		$.spinner().start();
		$.ajax({
			url: $(this).data('href'),
			success: function (data) {
				if (data.error) {
					window.location.href = data.redirectUrl;
				} else {
					iamportPayment.requestBillingKey(data);
				}
			},
			error: function (err) {
				window.location.reload();
				$.spinner().stop();
			}
		});
	});
};

module.exports = base;
