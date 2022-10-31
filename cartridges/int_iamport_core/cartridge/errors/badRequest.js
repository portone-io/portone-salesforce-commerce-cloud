'use strict';

/**
 *
 * @param {string} message - The error message
 */
function BadRequestError(message) {
	// errorMessage: Resource.msgf('error.no.payment.information', 'checkout', null, customError.message)
	this.message = 'Failed to establish a connection';
	this.status = '400';
	this.code = '0';
	this.description = 'Bad Request';
}

module.exports = BadRequestError;
