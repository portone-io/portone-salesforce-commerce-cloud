/* eslint-disable no-undef */
'use strict';

const assert = require('chai').assert;
const ArrayList = require('../../../mocks/dw.util.Collection');

var iamportPaymentMethods = new ArrayList([
	{
		ID: 'CREDIT_CARD',
		name: 'Credit Card'
	}
]);

describe('Payment', function () {
	let PaymentModel = require('../../../mocks/models/payment');

	it('should retrieve the selected payment gateway ', function () {
		let result = new PaymentModel(createApiBasket({ paymentMethods: paymentMethods }), null);
	});

	it('should validate the selected payment methods and return thr right ones', function () {
		let result = new PaymentModel(createApiBasket({ paymentCards: paymentCards }), null);
	});
});
