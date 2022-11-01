'use strict';

/**
 * Map custom error
 * @constructor
 * @classdesc takes the error object and map it with a friendly error parameters for the storefront
 * @param {Object} error - The error message
 */
function CustomError(error) {
	switch (error.status) {
		case 400:
			this.message = 'Permission Denied';
			this.note = '';
			break;
		case 401:
			this.message = 'Failed to establish a connection';
			this.note = '';
			break;
		case 404:
			this.message = 'Service could not be reached';
			this.note = '';
			break;
		case 500:
			this.message = 'Server down';
			this.note = '';
			break;
		default:
			this.message = 'Contact customer service';
			this.note = '';
			break;
	}
}

module.exports = CustomError;
