'use strict';

const BasketMgr = require('dw/order/BasketMgr');
const OrderMgr = require('dw/order/OrderMgr');
const Transaction = require('dw/system/Transaction');
const base = module.superModule;

/**
 * Recreate the current basket from an existing order
 *
 * @param {Object} order - The current order to recreate the basket from
 * @param {string} subject - The topic for the order note
 * @param {string} reason - The reason for modifying the order note
 */
function addOrderNote(order, subject, reason) {
	if (!empty(order)) {
		Transaction.wrap(function () {
			order.addNote(subject, reason);
		});
	}
}

/**
 * Recreate the current basket from an existing order
 *
 * @param {Object} order - The current order to recreate the basket from
 * @param {string} subject - The topic for the order note
 * @param {string} reason - The reason for modifying the order note
 */
function recreateCurrentBasket(order, subject, reason) {
	if (!empty(order)) {
		// recreate the basket from the current order and fail the order afterwards
		let currentBasket = BasketMgr.getCurrentOrNewBasket();
		let defaultShipment = currentBasket.getDefaultShipment();

		Transaction.wrap(function () {
			order.getProductLineItems().toArray().forEach((productLineItem) => {
				let newProductLineItem = currentBasket.createProductLineItem(productLineItem.productID, defaultShipment);
				newProductLineItem.setQuantityValue(productLineItem.getQuantityValue());
			});

			OrderMgr.failOrder(order, true);
			// add order note
			addOrderNote(order, subject, reason);
		});
	}
}

module.exports = Object.assign(base, {
	recreateCurrentBasket: recreateCurrentBasket,
	addOrderNote: addOrderNote
});
