'use strict';

const processInclude = require('base/util');

$(function () {
	let sfra5Enabled = $('input[name="sfra5Enabled"]').val();

	if (sfra5Enabled === 'true') {
		processInclude(require('./checkout/checkoutSFRA5'));
		return;
	}

	processInclude(require('./checkout/checkoutSFRA6'));
});
