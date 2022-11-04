'use strict';

const iamportUtilities = require('./utils/common');

/**
 * Util that will check if an element is present as part of the window object and if so, will invoke a function
 * @param {string} item element to verify, defer will loop until this element gets available on window object
 * @param {function} callback function that will be invoke once item get gets available on window object
 * @param {Object} paymentPayload payment resources
 * @param {number} [max] maximum number of iterations. The specified value must be greater than the default. Default 10
 * @param {number} [waitTime] duration for one iteration in milliseconds. Default 100ms
 */
const defer = function (item, callback, paymentPayload, max, waitTime) {
	let iter = 0;
	waitTime = waitTime || 100;
	max = Math.max(max, 10);
	if (window[item] && typeof window[item] !== 'undefined') {
		callback(item, paymentPayload);
	} else {
		if (max > iter) {
			iter += 1;
			setTimeout(function () {
				defer(item, callback, paymentPayload, max, iter);
			}, waitTime);
		} else {
			let message = 'Couldn\'\t establish a connection. Please check you internet connection and try again';
			iamportUtilities.createErrorNotification(message);
		}
	}
};

module.exports = { defer: defer };
