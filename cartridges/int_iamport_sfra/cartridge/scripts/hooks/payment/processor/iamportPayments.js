'use strict';

const Logger = require('dw/system/Logger').getLogger('iamport', 'Iamport');
const Transaction = require('dw/system/Transaction');
const Resource = require('dw/web/Resource');
const Order = require('dw/order/Order');
const PaymentMgr = require('dw/order/PaymentMgr');
const Money = require('dw/value/Money');
const OrderMgr = require('dw/order/OrderMgr');

/**
 * Iamport hook form processor
 * @param {Object} req - The request object
 * @param {Object} paymentForm - the payment form
 * @param {Object} viewFormData - object contains billing form data
 * @returns {Object} an object that has error information or payment information
 */
function processForm(req, paymentForm, viewFormData) {
	viewFormData.paymentMethod = {
		value: paymentForm.paymentMethod.value,
		htmlName: paymentForm.paymentMethod.value
	};

	return {
		viewData: viewFormData,
		success: true,
		error: false
	};
}


/**
 * Handle entry point for Iamport integration
 * @param {dw.order.Basket} basket Current users's basket
 * @param {Object} paymentInformation - the payment information
 * @param {string} paymentMethodID - payment method id
 * @param {Object} req the request object
 * @returns {Object} processor result
 */
function Handle(basket, paymentInformation, paymentMethodID, req) {
	let result;

	try {
		result = Transaction.wrap(function () {
			let paymentInstrument;
			if (empty(basket.getPaymentInstruments(paymentMethodID))) {
				paymentInstrument = basket.createPaymentInstrument(
					paymentMethodID,
					basket.getTotalGrossPrice()
				);
			} else {
				paymentInstrument = basket.getPaymentInstruments(paymentMethodID);
			}

			return {
				paymentInstrument: paymentInstrument,
				success: true,
				error: false
			};
		});
	} catch (e) {
		Logger.error('Error on payment "Handle" hook: {0}.', e.message);
		result = {
			paymentInstrument: null,
			success: false,
			error: e
		};
	}
	return result;
}


/**
 * Authorizes a payment using PayPal Plus
 * @param {number} orderNumber - The current order's number
 * @param {dw.order.PaymentInstrument} paymentInstrument -  The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor -  The payment processor of the current
 *      payment method
 * @return {Object} returns an error object
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
	let serverErrors = [];
	let fieldErrors = {};
	let error = false;

	try {
		Transaction.wrap(function () {
			paymentInstrument.paymentTransaction.setTransactionID(orderNumber);
			paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);
		});
	} catch (e) {
		error = true;
		serverErrors.push(
			Resource.msg('error.technical', 'checkout', null)
		);
	}

	return { fieldErrors: fieldErrors, serverErrors: serverErrors, error: error };
}

/**
 * Update the iamport payment id (imp_uid) attribute on the Order object
 * @param {string} paymentId - The payment identifier
 * @param {Object} order - The current order
 */
function updatePaymentIdOnOrder(paymentId, order) {
	try {
		Transaction.wrap(function () {
			let paymentInstruments = order.getPaymentInstruments();

			if (!empty(paymentInstruments)) {
				let paymentTransaction = paymentInstruments[0].paymentTransaction;

				if (paymentTransaction) {
					order.paymentInstruments[0].paymentTransaction.setTransactionID(paymentId);
				}
			}

			order.custom.imp_uid = paymentId;
		});
	} catch (e) {
		Logger.error('Could not update iamport payment id on the order object: {0}', e.stack);
	}
}

/**
 * Updates the virtual bank attribute on the current order
 * @param {boolean} status - Virtual payment status
 * @param {Object} vbankPayload - The virtual payment data
 * @param {Object} order - The current order
 */
function updateVbankOnOrder(status, vbankPayload, order) {
	try {
		Transaction.wrap(function () {
			if (order.custom.vbank) {
				order.custom.vbank = status;
			}

			if (order.custom.vbankNumber) {
				order.custom.vbankNumber = vbankPayload.vbankNumber;
			}

			if (order.custom.vbankExpiration) {
				order.custom.vbankExpiration = vbankPayload.vbankExpiration;
			}
		});
	} catch (e) {
		Logger.error('Could not update iamport payment id on the order object: {0}', e.stack);
	}
}

/**
 * Save Iamport data on payment transaction
 * @param {dw.order.Order} order The current order
 * @param {ServiceResult} paymentData The returned payment data
 * @param {Object} req The current request
 * @returns {Object} Returns the post authorize result
 */
function postAuthorize(order, paymentData, req) {
	const paymentMethod = 'Iamport';

	let paymentInstrument = null;
	let paymentInstruments;
	let paymentProcessor;
	let paymentTransaction;
	let orderStatus;

	return Transaction.wrap(function () {
		paymentInstruments = order.getPaymentInstruments(paymentMethod);
		if (paymentInstruments.length > 0) {
			paymentInstrument = paymentInstruments.toArray()[0];
		}

		if (empty(paymentInstrument)) {
			Logger.error('Payment Instrument is empty.');
			return {
				success: false,
				error: true
			};
		}

		if (paymentData.getObject().response.amount) {
			paymentProcessor = PaymentMgr.getPaymentMethod(paymentMethod).getPaymentProcessor();
			paymentTransaction = paymentInstrument.getPaymentTransaction();
			paymentTransaction.setPaymentProcessor(paymentProcessor);
			paymentTransaction.setTransactionID(paymentData.object.response.imp_uid);
			paymentTransaction.setAmount(
				new Money(
					parseFloat(paymentData.getObject().response.amount),
					'USD'
				)
			);

			if (order.getPaymentStatus() !== Order.PAYMENT_STATUS_PAID) {
				order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
			}

			let paymentId = paymentData.getObject().response.imp_uid;
			updatePaymentIdOnOrder(paymentId, order);
		}

		orderStatus = order.getStatus().getValue();
		return {
			success: orderStatus !== Order.ORDER_STATUS_FAILED,
			error: orderStatus === Order.ORDER_STATUS_FAILED
		};
	});
}

/**
 * Save Iamport data on payment transaction
 * @param {dw.order.Order} order The current order
 * @returns {Object} Returns the post authorize result
 */
function cancelOrder(order) {
	let paymentStatus;
	let orderStatus;

	return Transaction.wrap(function () {
		OrderMgr.cancelOrder(order);

		paymentStatus = order.getPaymentStatus();
		if (paymentStatus === Order.PAYMENT_STATUS_PAID) {
			order.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);
		}

		orderStatus = order.getStatus().getValue();
		return {
			success: orderStatus === Order.ORDER_STATUS_CANCELLED,
			error: orderStatus !== Order.ORDER_STATUS_CANCELLED
		};
	});
}

/**
 * Save Iamport data on payment transaction
 * @param {dw.order.Order} order The current order
 * @returns {Object} Returns the post authorize result
 */
function vbankIssued(order) {
	return Transaction.wrap(function () {
		let orderStatus = order.getStatus().getValue();

		return {
			success: orderStatus === Order.ORDER_STATUS_CREATED,
			error: orderStatus !== Order.ORDER_STATUS_CREATED
		};
	});
}

module.exports = {
	processForm: processForm,
	Handle: Handle,
	Authorize: Authorize,
	postAuthorize: postAuthorize,
	cancelOrder: cancelOrder,
	vbankIssued: vbankIssued,
	updatePaymentIdOnOrder: updatePaymentIdOnOrder,
	updateVbankOnOrder: updateVbankOnOrder
};
