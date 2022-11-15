'use strict';

const baseEmailHelpers = module.superModule;

baseEmailHelpers.emailTypes.orderCancellation = 7;
baseEmailHelpers.emailTypes.vbankIssuance = 8;

module.exports = baseEmailHelpers;
