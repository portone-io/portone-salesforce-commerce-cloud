'use strict';

const LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');

/**
 * Get the Iamport authentication access token
 * @returns {Object} returns the response from iamport
 */
const getAuthAccessToken = LocalServiceRegistry.createService('', {
	createRequest: function (svc, args) {
		svc.setURL(svc.getURL() + '/users/getToken');
		svc.setAuthentication('BASIC');
		svc.setRequestMethod('POST');
		svc.addHeader('Content-Type', 'application/x-www-form-urlencoded');
		svc.addParam('grant_type', 'client_credentials');
	},
	parseResponse: function (svc, response) {
		return JSON.parse(response.text);
	}
});

/**
 * Get the w Plus auth, including token.
 * @returns {Object} returns the response from iamport
 */
const getAuth = LocalServiceRegistry.createService('iamportPlus', {
	createRequest: function (svc, args) {
		svc.setURL(svc.getURL() + '/v1/oauth2/token');
		svc.setAuthentication('BASIC');
		svc.setRequestMethod('POST');
		svc.addHeader('Content-Type', 'application/x-www-form-urlencoded');
		svc.addParam('grant_type', 'client_credentials');
	},
	parseResponse: function (svc, response) {
		return JSON.parse(response.text);
	}
});

/**
 * Validate the payment amount with Iamport
 * @returns {Object} returns the response from iamport
 */
const validatePayment = LocalServiceRegistry.createService('', {
	createRequest: function (svc, args) {
		const auth = getAuth.call();
		const token = auth.isOk() && auth.object.access_token;
		svc.setURL(svc.getURL() + '/payments/prepare');
		svc.setAuthentication('NONE');
		svc.setRequestMethod('GET');
		svc.addHeader('Content-Type', 'application/json');
		svc.addHeader('Authorization', 'Bearer ' + token);
	},
	parseResponse: function (svc, response) {
		return JSON.parse(response.text);
	}
});

/**
 * Get payment information from Iamport
 * @returns {Object} returns the response from iamport
 */
const getPaymentInformation = LocalServiceRegistry.createService('', {
	createRequest: function (svc, args) {
		const auth = getAuth.call();
		const token = auth.isOk() && auth.object.access_token;
		svc.setURL(svc.getURL() + '/payments/' + args.paymentID);
		svc.setAuthentication('NONE');
		svc.setRequestMethod('GET');
		svc.addHeader('Content-Type', 'application/json');
		svc.addHeader('Authorization', 'Bearer ' + token);
	},
	parseResponse: function (svc, response) {
		return JSON.parse(response.text);
	}
});

module.exports = {
	getAuthAccessToken: getAuthAccessToken,
	getPaymentInformation: getPaymentInformation,
	validatePayment: validatePayment
};
