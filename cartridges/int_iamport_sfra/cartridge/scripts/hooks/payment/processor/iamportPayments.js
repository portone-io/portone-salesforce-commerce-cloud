'use strict';

var iamportLogger = require('dw/system/Logger').getLogger('iamport', 'Iamport');
var Transaction = require('dw/system/Transaction');
var Resource = require('dw/web/Resource');
var Order = require('dw/order/Order');
var PaymentMgr = require('dw/order/PaymentMgr');
var Money = require('dw/value/Money');
var OrderMgr = require('dw/order/OrderMgr');
var collections = require('*/cartridge/scripts/util/collections');

/**
 * Iamport hook form processor
 * @param {Object} req - The request object
 * @param {Object} paymentForm - the payment form
 * @param {Object} viewFormData - object contains billing form data
 * @returns {Object} an object that has error information or payment information
 */
function processForm(req, paymentForm, viewFormData) {
	var array = require('*/cartridge/scripts/util/array');
	var viewData = viewFormData;
	viewFormData.paymentMethod = {
		value: paymentForm.paymentMethod.value,
		htmlName: paymentForm.paymentMethod.value
	};
	if (req.form.storedPaymentUUID) {
		viewData.storedPaymentUUID = req.form.storedPaymentUUID;
	}

	// process payment information of saved credit card
	if (viewData.storedPaymentUUID && req.currentCustomer.raw.authenticated && req.currentCustomer.raw.registered) {
		var paymentInstruments = req.currentCustomer.wallet.paymentInstruments;
		var paymentInstrument = array.find(paymentInstruments, function (item) {
			return viewData.storedPaymentUUID === item.UUID;
		});
		viewData.paymentInformation = {
			cardNumber: {
				value: 'iamportCreditCardNumber' in paymentInstrument.raw.custom ? paymentInstrument.raw.custom.iamportCreditCardNumber : '',
				htmlName: 'iamportCreditCardNumber' in paymentInstrument.raw.custom ? paymentInstrument.raw.custom.iamportCreditCardNumber : ''
			},
			cardType: {
				value: paymentInstrument.creditCardType,
				htmlName: paymentInstrument.creditCardType
			}

		};
		viewData.paymentInformation.creditCardToken = paymentInstrument.raw.creditCardToken;
	}
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
	var currentBasket = basket;
	var cardNumber = paymentInformation != null && paymentInformation.cardNumber != null ? paymentInformation.cardNumber.value : '';
	var cardType = paymentInformation != null && paymentInformation.cardType != null ? paymentInformation.cardType.value : '';
	var creditCardToken = paymentInformation != null && paymentInformation.creditCardToken != null ? paymentInformation.creditCardToken : '';
	let result;

	// Invalid Payment Instrument
	if (!empty(cardNumber) && !empty(cardType) && empty(creditCardToken)) {
		var invalidPaymentMethod = Resource.msg('error.card.information.error', 'creditCard', null);
		return {
			fieldErrors: [],
			serverErrors: [invalidPaymentMethod],
			error: true
		};
	}


	try {
		result = Transaction.wrap(function () {
			var paymentInstruments = currentBasket.getPaymentInstruments(
				paymentMethodID
			);

			collections.forEach(paymentInstruments, function (item) {
				currentBasket.removePaymentInstrument(item);
			});

			var paymentInstrument = currentBasket.createPaymentInstrument(
				paymentMethodID, currentBasket.totalGrossPrice
			);
			// set the selected credit card in basket payment instrument.
			if (!empty(cardNumber) && !empty(cardType) && !empty(creditCardToken)) {
				paymentInstrument.setCreditCardHolder(currentBasket.billingAddress.fullName);
				paymentInstrument.setCreditCardNumber(cardNumber);
				paymentInstrument.setCreditCardType(cardType);
				paymentInstrument.setCreditCardToken(creditCardToken);
			}
			return {
				paymentInstrument: paymentInstrument,
				success: true,
				error: false
			};
		});
	} catch (e) {
		iamportLogger.error('Error on payment "Handle" hook: {0}.', e.message);
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
			order.custom.imp_uid = paymentId;
		});
	} catch (e) {
		iamportLogger.error('Could not update iamport payment id on the order object: \n{0}: {1}', e.message, e.stack);
	}
}

/**
 * Update the iamport payment id (imp_uid) attribute on the payment transaction id of the Order object
 * @param {string} paymentId - The payment identifier
 * @param {Object} order - The current order
 */
function updateTransactionIdOnOrder(paymentId, order) {
	try {
		Transaction.wrap(function () {
			let paymentInstruments = order.getPaymentInstruments();

			if (!empty(paymentInstruments)) {
				let paymentTransaction = paymentInstruments[0].paymentTransaction;

				if (paymentTransaction) {
					order.paymentInstruments[0].paymentTransaction.setTransactionID(paymentId);
				}
			}
		});
	} catch (e) {
		iamportLogger.error('Could not update iamport payment id on the payment transaction id order object: \n{0}: {1}', e.message, e.stack);
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
			order.custom.isVirtualPayment = status;
			order.custom.vbankNumber = vbankPayload.vbankNumber;
			order.custom.vbankExpiration = vbankPayload.vbankExpiration;
		});
	} catch (e) {
		iamportLogger.error('Could not update vbank data on the order object: {0}', e.stack);
	}
}

/**
 * Updates the selected payment method on the current basket object
 * @param {string} paymentMethod - The selected payment method
 * @param {Object} currentBasket - The current basket
 */
function updatePaymentMethodOnBasket(paymentMethod, currentBasket) {
	try {
		Transaction.wrap(function () {
			currentBasket.custom.pay_method = paymentMethod;
		});
	} catch (e) {
		iamportLogger.error('Could not update vbank data on the order object: {0}', e.stack);
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
			iamportLogger.error('Payment Instrument is empty.');
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
	updateVbankOnOrder: updateVbankOnOrder,
	updatePaymentMethodOnBasket: updatePaymentMethodOnBasket,
	updateTransactionIdOnOrder: updateTransactionIdOnOrder
};
