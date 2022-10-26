'use strict';

const processInclude = require('base/util');

$(function () {
	console.log('clicked');

	processInclude(require('./poc/generalPayment'));
});
