'use strict';

const UnauthorizedError = require('*/cartridge/errors/unauthorized');
const BadRequestError = require('*/cartridge/errors/badRequest');

/**
 *
 * @param {Object} error - The error message
 * @return {Object} - The customized error
 */
function CustomError(error) {
	let customError;

	switch (error.status) {
		case 400:
			customError = new BadRequestError(error.message);
			break;
		case 401:
			customError = new UnauthorizedError(error.message);
			break;
		case 404:
			//
			break;
		case 500:
			//
			break;
		default:
			break;
	}

	return customError;
}

module.exports = CustomError;
