/* eslint-disable require-jsdoc */
/* eslint-disable no-undef */
'use strict';

const assert = require('chai').assert;
const testData = require('../../../testData/testData');

function createApiBasket(options) {
	let basket = {
		totalGrossPrice: {
			value: 'some value'
		}
	};

	if (options && options.paymentMethods) {
		basket.paymentMethods = options.paymentMethods;
	}

	if (options && options.paymentCards) {
		basket.paymentCards = options.paymentCards;
	}

	if (options && options.paymentInstruments) {
		basket.paymentInstruments = options.paymentInstruments;
	}

	return basket;
}

describe('Payment Model', function () {
	let PaymentModel = require('../../../mocks/models/payment');
	let paymentModel;

	before(function () {
		paymentModel = new PaymentModel(createApiBasket(), null, null);
	});

	it('should return the selected payment gateway', function () {
		assert.equal(paymentModel.iamportPaymentGateway, testData.paymentGateway);
	});

	it('should return the selected number of payment methods after validation', function () {
		assert.equal(paymentModel.iamportPaymentMethods.length, testData.paymentMethods.length);
	});

	it('should return only the payment methods that passed the validation', function () {
		let paymentMethods = testData.paymentMethods;
		let dummyPaymentMethod = { value: 'dummyPG', displayValue: 'Dummy Payment Gateway' };

		paymentMethods.push(dummyPaymentMethod);
		assert.notEqual(paymentModel.iamportPaymentMethods.length, paymentMethods.length);

		paymentModel.iamportPaymentMethods.forEach(function (paymentMethod) {
			assert.notInclude(paymentMethod, dummyPaymentMethod);
		});
	});
});
