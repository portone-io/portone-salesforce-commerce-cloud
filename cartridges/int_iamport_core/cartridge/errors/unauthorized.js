'use strict';

/**
 *
 * @param {string} message - The error message
 */
function UnauthorizedError(message) {
	// errorMessage: Resource.msgf('error.payment.not.registered', 'checkout', null, customError.message)
	this.message = 'Permission failed';
	this.status = '401';
	this.code = '-1';
	this.description = 'Unauthorized';
	this.note = 'SFCC server failed to establish a connection with Iamport server. Check the service credentials and try again.';
}

module.exports = UnauthorizedError;
