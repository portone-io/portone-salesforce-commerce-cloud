'use strict';

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
	getCookie: getCookie
};
