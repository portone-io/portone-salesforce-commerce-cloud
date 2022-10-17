'use strict';

const testData = require('../../../testData/testData');

module.exports = {
	getCurrent: function () {
		return {
			getCustomPreferenceValue: function (value) {
				return value === 'iamport_paymentGateway' ? testData.paymentGateway : 'CustomPreferenceValue';
			},
			getPreferences: function () {
				return {
					getCustom: function () {
						let result = {};
						result[testData.paymentMethodsAttributeID] = testData.paymentMethods;

						return result;
					}
				};
			}
		};
	},
	current: {
		getCustomPreferenceValue: function () {
			return 'CustomPreferenceValue';
		}
	}
};
