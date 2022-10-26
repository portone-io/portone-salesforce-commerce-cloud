'use strict';

window.jQuery = window.$ = require('jquery');
let processInclude = require('base/util');

$(function () {
	processInclude(require('base/components/menu'));
	processInclude(require('base/components/cookie'));
	processInclude(require('base/components/consentTracking'));
	processInclude(require('base/components/footer'));
	processInclude(require('base/components/miniCart'));
	processInclude(require('base/components/collapsibleItem'));
	processInclude(require('base/components/search'));
	processInclude(require('base/components/clientSideValidation'));
	processInclude(require('base/components/countrySelector'));
	processInclude(require('base/components/toolTip'));
	processInclude(require('./testPoc'));
});

require('base/thirdParty/bootstrap');
require('base/components/spinner');
