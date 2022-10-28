'use strict';

const LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
const ServiceCredential = require('dw/svc/ServiceCredential');
const ServiceMock = require('*/cartridge/scripts/service/iamportApiMock');

/**
 * Get the Iamport authentication access token
 * @returns {Object} returns the response from iamport
 */
const getAuthAccessToken = LocalServiceRegistry.createService('iamport_authenticate', {
	createRequest: function (svc, args) {
		let credential = svc.getConfiguration().getCredential();

		if (!(credential instanceof ServiceCredential)) {
			// TODO: Log error
			return JSON.stringify(args);
		}

		svc.setURL(credential.getURL());
		svc.setAuthentication('BASIC');
		svc.setRequestMethod('POST');
		svc.addHeader('Content-Type', 'application/json');
		svc.addParam('grant-type', 'client_credentials');

		// map the service credentials to import credentials
		args = {
			imp_key: credential.user,
			imp_secret: credential.password
		};

		return JSON.stringify(args);
	},
	parseResponse: function (svc, response) {
		return JSON.parse(response.text);
	},
	mockFull: function (svc, args) {
		return ServiceMock.auth;
	}
});

/**
 * Register and validate the payment amount with Iamport
 * @returns {Object} returns the response from iamport
 */
const registerAndValidatePayment = LocalServiceRegistry.createService('iamport_validatePayment', {
	createRequest: function (svc, args) {
		const auth = getAuthAccessToken.call();
		const token = auth.isOk() && auth.object.response.access_token;
		svc.setURL(svc.getURL());
		svc.setAuthentication('NONE');
		svc.setRequestMethod('GET');
		svc.addHeader('Content-Type', 'application/json');
		svc.addHeader('Authorization', 'Bearer ' + token);
	},
	parseResponse: function (svc, response) {
		return JSON.parse(response.text);
	},
	mockFull: function (svc, args) {
		return ServiceMock.validatePayment;
	}
});

/**
 * Get payment information from Iamport
 * @returns {Object} returns the response from iamport
 */
const getPaymentInformation = LocalServiceRegistry.createService('iamport_getPaymentInfo', {
	createRequest: function (svc, args) {
		const auth = getAuthAccessToken.call();
		const token = auth.isOk() && auth.object.response.access_token;
		svc.setURL(svc.getURL() + args.paymentID);
		svc.setAuthentication('NONE');
		svc.setRequestMethod('GET');
		svc.addHeader('Content-Type', 'application/json');
		svc.addHeader('Authorization', 'Bearer ' + token);
	},
	parseResponse: function (svc, response) {
		return JSON.parse(response.text);
	},
	mockFull: function (svc, args) {
		return ServiceMock.paymentInfo;
	}
});

module.exports = {
	getPaymentInformation: getPaymentInformation,
	registerAndValidatePayment: registerAndValidatePayment
};
