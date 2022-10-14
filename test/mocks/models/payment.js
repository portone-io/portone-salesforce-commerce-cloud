/* eslint-disable require-jsdoc */
'use strict';

const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const collections = require('../util/collections');
const Site = require('../dw/system/Site');
var iamportConstants = require('../../mocks/constants/iamportConstants');
// var URLUtils = require('../dw.web.URLUtils');

function proxyModel() {
	return proxyquire('../../../cartridges/int_iamport_sfra/cartridge/models/payment', {
		'*/cartridge/scripts/util/collections': collections,
		'dw/system/Site': Site,
		'*/cartridge/constants/iamportConstants': iamportConstants,
		'*/cartridge/config/pgValidators': require('../../../cartridges/int_iamport_sfra/cartridge/config/pgValidators'),
		'dw/order/PaymentMgr': {
			getApplicablePaymentMethods: function () {
				return [
					{
						ID: 'GIFT_CERTIFICATE',
						name: 'Gift Certificate'
					},
					{
						ID: 'CREDIT_CARD',
						name: 'Credit Card'
					}
				];
			},
			getPaymentMethod: function () {
				return {
					getApplicablePaymentCards: function () {
						return [
							{
								cardType: 'Visa',
								name: 'Visa',
								UUID: 'some UUID'
							},
							{
								cardType: 'Amex',
								name: 'American Express',
								UUID: 'some UUID'
							},
							{
								cardType: 'Discover',
								name: 'Discover'
							}
						];
					}
				};
			},
			getApplicablePaymentCards: function () {
				return ['applicable payment cards'];
			}
		},
		'dw/order/PaymentInstrument': {}
	});
}

module.exports = proxyModel();
