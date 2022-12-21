'use strict';

var base = require('base/paymentInstruments/paymentInstruments');
var iamportPayment = require('../iamport/paymentLoader');


base.addNewCard = function () {
	$('.btn-add-payment-card').on('click', function (e) {
		e.preventDefault();
		$.spinner().start();
		$.ajax({
			url: $(this).data('href'),
			success: function (response) {
				iamportPayment.requestBillingKey(response.paymentResources);
			},
			error: function (err) {
				if (err.responseJSON.redirectUrl) {
					window.location.href = err.responseJSON.redirectUrl;
				}
				$.spinner().stop();
			}
		});
	});
};

module.exports = base;
