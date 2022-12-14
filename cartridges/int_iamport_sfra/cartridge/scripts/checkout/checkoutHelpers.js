'use strict';

const BasketMgr = require('dw/order/BasketMgr');
const OrderMgr = require('dw/order/OrderMgr');
const Transaction = require('dw/system/Transaction');
const base = module.superModule;
const Resource = require('dw/web/Resource');
const Site = require('dw/system/Site');
const Status = require('dw/system/Status');
const Order = require('dw/order/Order');


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
 * Set the current site timeZone and return the time.
 * @param {string} date - response date
 * @param {string} format - the calendar format
 * @returns {Object} result - return calendar time
 */
function getTimeWithPreferredTimeZone(date, format) {
	const Calendar = require('dw/util/Calendar');
	const StringUtils = require('dw/util/StringUtils');
	let currentDate = new Date(0);
	currentDate.setUTCSeconds(date);
	var calendar = new Calendar(currentDate);
	var siteTimeZone = Site.getCurrent().timezone;
	calendar.setTimeZone(siteTimeZone);
	var result = StringUtils.formatCalendar(calendar, 'MM/dd/yyyy h:mm a');
	return result;
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

/**
 * Send order cancellation email
 * @param {dw.order.Order} order - The current user's order
 * @param {string} locale - the current request's locale id
 * @returns {void}
 */
function sendPaymentOrderCancellationEmail(order, locale) {
	const OrderModel = require('*/cartridge/models/order');
	const emailHelpers = require('*/cartridge/scripts/helpers/emailHelpers');
	const Locale = require('dw/util/Locale');

	let currentLocale = Locale.getLocale(locale);
	let orderModel = new OrderModel(order, { countryCode: currentLocale.country, containerView: 'order' });
	let orderObject = { order: orderModel };

	let emailObj = {
		to: order.customerEmail,
		subject: Resource.msg('order.payment.cancellation.subject', 'order', null),
		from: Site.current.getCustomPreferenceValue('customerServiceEmail') || 'no-reply@testorganization.com',
		type: emailHelpers.emailTypes.orderCancellation
	};

	emailHelpers.sendEmail(emailObj, 'checkout/confirmation/cancellationEmail', orderObject);
}

/**
 * Send order vbank issuance email
 * @param {dw.order.Order} order - The current user's order
 * @param {string} paymentData - the payment data
 * @returns {void}
 */
function sendVbankIssuanceEmail(order, paymentData) {
	const emailHelpers = require('*/cartridge/scripts/helpers/emailHelpers');

	let paymentResponse = paymentData.getObject().response;
	let vbankExpiration = getTimeWithPreferredTimeZone(paymentResponse.vbank_date);
	let vbankIssuedAt = getTimeWithPreferredTimeZone(paymentResponse.vbank_issued_at);

	let vbankPaymentDataObject = {
		orderNo: order.orderNo,
		vbankPayload: {
			vbankName: paymentResponse.vbank_name,
			vbankNumber: paymentResponse.vbank_num,
			vbankExpiration: vbankExpiration,
			vbankCode: paymentResponse.vbank_code,
			vbankIssuedAt: vbankIssuedAt,
			vbankHolder: paymentResponse.vbank_holder
		}
	};

	let emailObj = {
		to: order.customerEmail,
		subject: Resource.msg('order.payment.vbank.subject', 'order', null),
		from: Site.current.getCustomPreferenceValue('customerServiceEmail') || 'no-reply@testorganization.com',
		type: emailHelpers.emailTypes.vbankIssuance
	};

	emailHelpers.sendEmail(emailObj, 'checkout/confirmation/vbankIssuanceEmail', vbankPaymentDataObject);
}

/**
 * Override this function because placeorder method will return object not string
 * @param {dw.order.Order} order - The order object to be placed
 * @param {Object} fraudDetectionStatus - an Object returned by the fraud detection hook
 * @returns {Object} an error object
 */
function placeOrder(order, fraudDetectionStatus) {
	var result = { error: false };

	try {
		Transaction.begin();
		var placeOrderStatus = OrderMgr.placeOrder(order);
		if (placeOrderStatus.status === Status.ERROR) {
			throw new Error();
		}

		if (fraudDetectionStatus.status === 'flag') {
			order.setConfirmationStatus(Order.CONFIRMATION_STATUS_NOTCONFIRMED);
		} else {
			order.setConfirmationStatus(Order.CONFIRMATION_STATUS_CONFIRMED);
		}

		order.setExportStatus(Order.EXPORT_STATUS_READY);
		Transaction.commit();
	} catch (e) {
		Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
		result.error = true;
	}

	return result;
}

module.exports = Object.assign(base, {
	recreateCurrentBasket: recreateCurrentBasket,
	addOrderNote: addOrderNote,
	sendPaymentOrderCancellationEmail: sendPaymentOrderCancellationEmail,
	sendVbankIssuanceEmail: sendVbankIssuanceEmail,
	getTimeWithPreferredTimeZone: getTimeWithPreferredTimeZone,
	placeOrder: placeOrder
});
