'use strict';

var processInclude = require('base/util');
var sfra5Enabled = $('input[name="sfra5Enabled"]').val();
var checkoutFile = sfra5Enabled === 'true' ? require('./checkout/checkoutSFRA5') : require('./checkout/checkoutSFRA6');
$(document).ready(function () {
	processInclude(checkoutFile);
});
