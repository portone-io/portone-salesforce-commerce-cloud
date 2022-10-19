'use strict';

const AddressModel = require('*/cartridge/models/address');
const BillingModel = require('*/cartridge/models/billing');
const PaymentModel = require('*/cartridge/models/payment');

const baseOrder = module.superModule;
const DEFAULT_MODEL_CONFIG = { numberOfLineItems: '*' };


/**
 * Returns the matching address ID or UUID for a billing address
 * @param {dw.order.Basket} basket - line items model
 * @param {Object} customer - customer model
 * @return {string|boolean} returns matching ID or false
*/
function getAssociatedAddress(basket, customer) {
	let address = basket.billingAddress;
	let matchingId;
	let anAddress;

	if (!address) return false;

    // First loop through all shipping addresses
	for (let i = 0, ii = basket.shipments.length; i < ii; i++) {
		anAddress = basket.shipments[i].shippingAddress;

		if (anAddress && anAddress.isEquivalentAddress(address)) {
			matchingId = basket.shipments[i].UUID;
			break;
		}
	}

    // If we still haven't found a match, then loop through customer addresses to find a match
	if (!matchingId && customer && customer.addressBook && customer.addressBook.addresses) {
		for (let j = 0, jj = customer.addressBook.addresses.length; j < jj; j++) {
			anAddress = customer.addressBook.addresses[j];

			if (anAddress && anAddress.isEquivalentAddress(address)) {
				matchingId = anAddress.ID;
				break;
			}
		}
	}

	return matchingId;
}

/**
 * Order class that represents the current order
 * @extend Base Order
 * @param {dw.order.LineItemCtnr} lineItemContainer - Current users's basket/order
 * @param {Object} options - The current order's line items
 * @param {Object} options.config - Object to help configure the orderModel
 * @param {string} options.config.numberOfLineItems - helps determine the number of lineitems needed
 * @param {string} options.countryCode - the current request country code
 * @constructor
 */
function OrderModel(lineItemContainer, options) {
	let safeOptions = options || {};
	let modelConfig = safeOptions.config || DEFAULT_MODEL_CONFIG;
	let countryCode = safeOptions.countryCode || null;
	let customer = safeOptions.customer || lineItemContainer.customer;
	let paymentModel;

	baseOrder.call(this, lineItemContainer, options);

	let associatedAddress = getAssociatedAddress(lineItemContainer, customer);

	if (safeOptions.iamportPaymentOption) {
		paymentModel = new PaymentModel(lineItemContainer, customer, countryCode, safeOptions.iamportPaymentOption);
	} else {
		paymentModel = new PaymentModel(lineItemContainer, customer, countryCode);
	}

	let billingAddressModel = new AddressModel(lineItemContainer.billingAddress);
	let billingModel = new BillingModel(billingAddressModel, paymentModel, associatedAddress);


	if (modelConfig.numberOfLineItems === '*') {
		this.billing = billingModel;
	}
}

module.exports = OrderModel;
