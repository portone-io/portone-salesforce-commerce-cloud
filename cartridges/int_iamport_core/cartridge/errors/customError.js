'use strict';

const Resource = require('dw/web/Resource');

/**
 * Map custom error
 * @constructor
 * @classdesc takes the error object and map it with a friendly error parameters for the storefront
 * @param {Object} error - The error message
 */
function CustomError(error) {
	switch (error.status) {
		case 400:
			this.message = Resource.msg('msg.unauthorized.error', 'iamport', null);
			this.note = Resource.msg('note.unauthorized.error', 'iamport', null);
			break;
		case 401:
			this.message = Resource.msg('msg.bad.request.error', 'iamport', null);
			this.note = Resource.msg('note.bad.request.error', 'iamport', null);
			break;
		case 404:
			this.message = Resource.msg('msg.not.found.error', 'iamport', null);
			this.note = Resource.msg('note.not.found.error', 'iamport', null);
			break;
		case 500:
			this.message = Resource.msg('msg.server.error', 'iamport', null);
			this.note = Resource.msg('note.server.error', 'iamport', null);
			break;
		default:
			if (error.status === 2) {
				this.message = Resource.msg('error.payment.incomplete', 'checkout', null);
			} else {
				this.message = Resource.msg('msg.general.error', 'iamport', null);
				this.note = Resource.msg('note.general.error', 'iamport', null);
			}
			break;
	}
}

module.exports = CustomError;
