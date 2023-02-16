'use strict';

var assert = require('chai').assert;
var testData = require('../../../testData/testData');
var selectedPaymentMethod =
    {
        ID: 'card',
        name: 'Credit Card'
    }

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
	var PaymentModel = require('../../../mocks/models/payment');
	var paymentModel;
	before(function () {
		global.empty = function (obj) {
			if (obj === null || obj === undefined || obj === '' || (typeof (obj) !== 'function' && obj.length !== undefined && obj.length === 0)) {
				return true;
			} else {
				return false;
			}
		};
		paymentModel = new PaymentModel(createApiBasket(), null, null);
	});
	it('should return the selected payment gateway', function () {
		assert.equal(paymentModel.iamportPaymentGateway, testData.paymentGateway);
	});

	it('should return the selected payment method', function () {
		assert.equal(paymentModel.iamportPaymentMethods[0].value, selectedPaymentMethod.ID);
	});

	it('should return the number of display payment methods of selected payment gateway', function () {
		assert.equal(paymentModel.iamportPaymentMethods.length, testData.paymentMethods.length);
	});

	it('should return only the payment methods that passed the validation', function () {
		let dummyPaymentMethod = { value: 'dummyPG', displayValue: 'Dummy Payment Gateway' };

		paymentModel.iamportPaymentMethods.forEach(function (paymentMethod) {
			assert.notInclude(paymentMethod, dummyPaymentMethod);
		});
	});
});
