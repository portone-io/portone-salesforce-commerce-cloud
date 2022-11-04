'use strict';

/**
 * re-renders the order totals and the number of items in the cart
 * @param {Object} message - Error message to display
 */
function createErrorNotification(message) {
	let errorHtml = '<div class="alert alert-danger alert-dismissible valid-payment-error ' +
        'fade show" role="alert">' +
        '<button type="button" class="close" data-dismiss="alert" aria-label="Close">' +
        '<span aria-hidden="true">&times;</span>' +
        '</button>' + message + '</div>';

        // TODO: fix the location of this error message
	$('.payment-error').append(errorHtml);
}

/**
 * Get a cookie
 *
 * @param {string} cookieName - cookie name
 * @returns {string} - cookie value
 */
function getCookie(cookieName) {
	let name = cookieName + '=';
	let decodedCookie = decodeURIComponent(document.cookie);
	let allCookies = decodedCookie.split(';');

	for (let i = 0; i < allCookies.length; i += 1) {
		let cookie = allCookies[i];
		while (cookie.charAt(0) === ' ') {
			cookie = cookie.substring(1);
		}
		if (cookie.indexOf(name) === 0) {
			return cookie.substring(name.length, cookie.length);
		}
	}

	return '';
}

module.exports = {
	createErrorNotification: createErrorNotification,
	getCookie: getCookie
};
