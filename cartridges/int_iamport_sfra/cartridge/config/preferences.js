'use strict';

const Site = require('dw/system/Site');

var base = module.superModule;
var customPreferences = Site.current.preferences.custom;


base.SFRA5_ENABLED = 'iamport_enabledSFRA5' in customPreferences ? customPreferences.iamport_enabledSFRA5 : false;

module.exports = base;


