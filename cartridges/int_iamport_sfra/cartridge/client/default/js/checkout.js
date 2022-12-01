'use strict';

const processInclude = require('base/util');

$(function () {
	var sfra5Enabled = $('input[name="sfra5Enabled"]').val();

	if (sfra5Enabled === 'true') {
		processInclude(require('./checkout/checkoutSFRA5'));
		return;
	} else if (sfra5Enabled === 'false') {
		// Comment next line when you are working with SFRA 5. Uncomment on SFRA6
		// processInclude(require('./checkout/checkoutSFRA6'));
		return;
	}
	return;
});
