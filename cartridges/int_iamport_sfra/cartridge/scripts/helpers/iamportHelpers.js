'use strict';

const Resource = require('dw/web/Resource');
const iamportConstants = require('*/cartridge/constants/iamportConstants');
const Site = require('dw/system/Site');
const Calendar = require('dw/util/Calendar');
const StringUtils = require('dw/util/StringUtils');


/**
 *
 * @param {Object} order - Customer order data
 * @returns {Object} - array of objects consisting of the following 5 required product properties.
 */
function prepareNarverPayPaymentRequest(order) {
	var result = [];
	// iterate all product line items of the order and create product object with required attributes
	var productLineItems = order.getAllProductLineItems().iterator();
	while (productLineItems.hasNext()) {
		var productLineItem = productLineItems.next();
		result.push({
			categoryType: 'PRODUCT',
			categoryId: 'GENERAL',
			count: parseInt(productLineItem.quantity.value.toFixed(0), 10),
			name: productLineItem.productName,
			uid: productLineItem.productID
		});
	}
	return result;
}

/**
 * Prepares the payment resources needed to request payment to Iamport server
 * @param {Object} order - Customer order data
 * @param {string} selectedPaymentMethod - Id of the selected payment method
 * @param {string} noticeUrl - webhook receive URL. Default is undefined
 * @param {string} mobileRedirectUrl - redirect url(order confirmation page) for mobile
 * @param {string} selectedPG - pass payment gateway with merchant id.
 * @returns {Object} - The payment resources
 */
function preparePaymentResources(order, selectedPaymentMethod, noticeUrl, mobileRedirectUrl, selectedPG) {
	var siteTimeZone = Site.getCurrent().timezone;
	var paymentInformation = {
		pg: Site.getCurrent().getCustomPreferenceValue(iamportConstants.PG_ATTRIBUTE_ID).value,
		pay_method: selectedPaymentMethod
	};
	if (selectedPG) {
		paymentInformation.pg = selectedPG;
	}
	if (order.totalGrossPrice) {
		// Converting to whole numbers as Korean currency does not support decimal numbers.
		paymentInformation.amount = Number(order.totalGrossPrice.value.toFixed());
	}

	if (order.orderNo) {
		paymentInformation.merchant_uid = order.orderNo;
	}

	if (order.customerName) {
		paymentInformation.name = order.customerName;
	}

	if (order.customerEmail) {
		paymentInformation.buyer_email = order.customerEmail;
	}

	if (order.billingAddress.address1) {
		paymentInformation.buyer_addr = order.billingAddress.address1;
	}

	if (order.billingAddress.phone) {
		paymentInformation.buyer_tel = order.billingAddress.phone;
	}

	if (order.billingAddress.fullName) {
		paymentInformation.buyer_name = order.billingAddress.fullName;
	}

	if (order.billingAddress.postalCode) {
		paymentInformation.buyer_postcode = order.billingAddress.postalCode;
	}

	if (noticeUrl) {
		paymentInformation.notice_url = noticeUrl;
	}
	if (mobileRedirectUrl && request.httpUserAgent.indexOf('Mobile') > -1) {
		paymentInformation.m_redirect_url = mobileRedirectUrl;
		paymentInformation.popup = false;
	}
	if (paymentInformation.pg.indexOf('naverpay') > -1) {
		paymentInformation.tax_free = 0;
		paymentInformation.naverPopupMode = true;
		if ('getAllProductLineItems' in order) {
			paymentInformation.naverProducts = prepareNarverPayPaymentRequest(order);
		}
		if ('isSubscription' in order && order.isSubscription) {
			paymentInformation.naverProductCode = Site.getCurrent().getCustomPreferenceValue('iamport_naverPay_ProductCode');
		}
		paymentInformation.naverChainId = Site.getCurrent().getCustomPreferenceValue('iamport_naverPay_ChainId');
	}

	// additional parameters for virtual Account.
	if (selectedPaymentMethod === 'vbank') {
		var dueDays = Site.getCurrent().getCustomPreferenceValue('iamport_vbank_due');
		var bizNumber = Site.getCurrent().getCustomPreferenceValue('iamport_danal_biz_num');
		if (paymentInformation.pg.indexOf('danal') > -1 && bizNumber) {
			paymentInformation.biz_num = bizNumber;
		}
		if (dueDays) {
			var date = new Date();
			date.setTime(date.getTime() + (dueDays * 24 * 60 * 60 * 1000));
			var calendar = new Calendar(date);
			calendar.setTimeZone(siteTimeZone);
			var result = StringUtils.formatCalendar(calendar, 'yyyyMMddhhmm');
			paymentInformation.vbank_due = result;
		}
	}

	return paymentInformation;
}

/**
 * Compares the actual amount paid to Iamport to the transaction amount
 * @param {Object} paymentData - Iamport payment data
 * @param {order} order - The order
 * @returns {boolean} - if fraud is detected
 */
function checkFraudPayments(paymentData, order) {
	return paymentData.object.response.amount
		!== order.paymentTransaction.amount.value;
}

/**
 * Maps the payment information from Iamport removing all sensitive data
 * @param {Object} paymentData - Payment Information from Iamport
 * @returns {Object} - Mapped payment information
 */
function mapPaymentResponseForLogging(paymentData) {
	let paymentResponse = paymentData.getObject().response;
	return {
		paymentID: paymentResponse.imp_uid,
		orderID: paymentResponse.merchant_uid,
		paymentMethod: paymentResponse.pay_method,
		paymentGateway: paymentResponse.pg_provider,
		amountPaid: paymentResponse.amount,
		isEscrow: paymentResponse.escrow
	};
}

/**
 * Maps the virtual account information from Iamport
 * @param {Object} paymentData - Payment Information from Iamport
 * @returns {Object} - Mapped payment information
 */
function mapVbankResponseForLogging(paymentData) {
	let paymentResponse = paymentData.getObject().response;

	return Object.assign(mapPaymentResponseForLogging(paymentData), {
		vbankName: paymentResponse.vbank_name,
		vbankNumber: paymentResponse.vbank_num,
		vbankExpiration: paymentResponse.vbank_date,
		vbankCode: paymentResponse.vbank_code,
		vbankIssuedAt: paymentResponse.vbank_issued_at,
		vbankHolder: paymentResponse.vbank_holder
	});
}

/**
 * Returns the correct error message from the Payment Gateway, or exactly the same message
 * @param {string} errorCode - Error code from the PG response
 * @param {string} errorMessage - Error message content from the PG response
 * @return {string} - Error message
 */
function handleErrorFromPaymentGateway(errorCode, errorMessage) {
	if (errorCode === 'NOT_READY') {
		return Resource.msg('payment.gateway.error', 'iamport', null);
	}
	// This message from the PG response will be in korean. It should to be translated if
	return errorMessage;
}

/**
 * Returns translated error message from the payment gateway, or exactly the same message sent from payment gateway
 * @param {string} pgType - Payment Gateway step type from the PG response
 * @param {string} errorMessage - Error message content from the PG response
 * @return {string} - Error message
 */
function getTranslatedMessage(pgType, errorMessage) {
	if (pgType === 'payment') {
		return Resource.msg('error.payment.incomplete', 'checkout', null);
	}
	return errorMessage;
}

/**
 *
 * @param {number} length - define the length of String
 * @returns {string} - return the generated Rendom String
 */
function generateString(length) {
	const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
	const charactersLength = characters.length;
	let result = '';
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}

/**
 * @param {dw.system.Request} req - system request object
 * @param {string} customerUid get the customer uid in client side response
 * @param {string} impUid get the imp_uid in mobile response
 * @returns {Object} - Response of Subcribe Payment
 */
function handleSubcribePaymentRequest(req, customerUid) {
	var iamportServices = require('*/cartridge/scripts/service/iamportService');
	var CustomError = require('*/cartridge/errors/customError');
	var iamportLogger = require('dw/system/Logger').getLogger('iamport', 'Iamport');
	var merchantUid = 'authsave_' + generateString(8);
	var payingAmount = iamportConstants.TEST_SUBSCRIBE_AMOUNT;
	var orderName = iamportConstants.SUBSCRIBE_ORDER_NAME;
	var profile = req.currentCustomer.profile;
	var profileName = profile.firstName + ' ' + profile.lastName;
	var phone = !empty(profile.phone) ? profile.phone : '0000000000';
	var requestBody = {
		customer_uid: customerUid,
		merchant_uid: merchantUid,
		amount: payingAmount,
		name: orderName,
		buyer_name: profileName,
		buyer_email: profile.email,
		buyer_tel: phone
	};

	var paymentResponse = iamportServices.subscribePayment.call(requestBody);
	if (!paymentResponse.isOk() || paymentResponse.getObject().message) {
		var iamportResponseError = paymentResponse.errorMessage;
		var errorcode = paymentResponse.error;
		if (paymentResponse.msg && paymentResponse.errorMessage) {
			errorcode = JSON.parse(paymentResponse.errorMessage).code;
		} else if (paymentResponse.getObject() != null && paymentResponse.getObject().message) {
			errorcode = paymentResponse.getObject().code;
		}
		iamportResponseError = new CustomError({ status: errorcode }).message;
		iamportLogger.error('IamportHelpers-Subscibe Payment request failed: {0}.', JSON.stringify(iamportResponseError));
	} else if (paymentResponse.isOk() && paymentResponse.getObject().message === null && paymentResponse.getObject().response && paymentResponse.getObject().response.card_number && paymentResponse.getObject().response.customer_uid) {
		var paymentResponseObj = paymentResponse.getObject().response;
		var CustomerMgr = require('dw/customer/CustomerMgr');
		var Transaction = require('dw/system/Transaction');
		var dwOrderPaymentInstrument = require('dw/order/PaymentInstrument');
		var accountHelpers = require('*/cartridge/scripts/helpers/accountHelpers');

		var customer = CustomerMgr.getCustomerByCustomerNumber(
			profile.customerNo
		);
		var wallet = customer.getProfile().getWallet();

		Transaction.wrap(function () {
			var paymentInstrument = wallet.createPaymentInstrument(dwOrderPaymentInstrument.METHOD_CREDIT_CARD);
			paymentInstrument.setCreditCardHolder(paymentResponseObj.buyer_name || '');
			paymentInstrument.setCreditCardNumber(paymentResponseObj.card_number);
			paymentInstrument.setCreditCardType(paymentResponseObj.card_name);
			paymentInstrument.setCreditCardToken(paymentResponseObj.customer_uid);
			// store the iamport credit card in custom attribute because system attribtue will convert in mask with last four digits.
			paymentInstrument.custom.iamportCreditCardNumber = paymentResponseObj.card_number;
			paymentInstrument.custom.iamportCreditCardPG = paymentResponseObj.pg_provider;
		});

		// Send account edited email
		accountHelpers.sendAccountEditedEmail(customer.profile);
	}
	return paymentResponse;
}

/**
 * get buyer's billing key information(customer uid) and make payment with billing key.
 * @param {Object} paymentResources - iamport payment request
 * @param {Object} paymentInstrument order paymentInstrument
 * @returns {Object} - Return Iamport Uid with error status.
 */
function paymentWithSavedCard(paymentResources, paymentInstrument) {
	var iamportServices = require('*/cartridge/scripts/service/iamportService');
	var iamportLogger = require('dw/system/Logger').getLogger('iamport', 'Iamport');
	var requestBody = {
		customerUid: paymentInstrument.creditCardToken
	};
	var response = {
		error: false,
		imp_uid: ''
	};
	// Get Buyer's billing key information(customer uid).
	var responseCustomerUID = iamportServices.getBillingKeyInformation.call(requestBody);
	try {
		if (responseCustomerUID.isOk()) {
			if (responseCustomerUID.getObject().message) {
				iamportLogger.error('IamportHelpers-paymentWithSavedCard Get Buyer Billing Key information failed: {0}.', JSON.stringify(responseCustomerUID.getObject().message));
				response.error = true;
			} else {
				paymentResources.customer_uid = paymentInstrument.creditCardToken;
				// make payment with the saved billing key(customer uid).
				var paymentResponse = iamportServices.subscribePayment.call(paymentResources);
				if (paymentResponse.isOk()) {
					if (responseCustomerUID.getObject().message) {
						iamportLogger.error('IamportHelpers-paymentWithSavedCard make payment with the saved billing key failed: {0}.', JSON.stringify(responseCustomerUID.getObject().message));
						response.error = true;
					} else {
						response.error = false;
						response.imp_uid = paymentResponse.getObject().response.imp_uid;
					}
				} else {
					iamportLogger.error('IamportHelpers-paymentWithSavedCard make payment with the saved billing key failed: {0}.', JSON.stringify(paymentResponse.errorMessage));
					response.error = true;
				}
			}
		} else {
			iamportLogger.error('IamportHelpers-paymentWithSavedCard Get Buyer Billing Key information failed: {0}.', JSON.stringify(responseCustomerUID.errorMessage));
			response.error = true;
		}
	} catch (e) {
		iamportLogger.error('IamportHelpers-payment With saved card customeruid failed: \n{0}: {1}', e.message, e.stack);
		response.error = true;
	}
	return response;
}


module.exports = {
	preparePaymentResources: preparePaymentResources,
	checkFraudPayments: checkFraudPayments,
	mapPaymentResponseForLogging: mapPaymentResponseForLogging,
	mapVbankResponseForLogging: mapVbankResponseForLogging,
	handleErrorFromPaymentGateway: handleErrorFromPaymentGateway,
	getTranslatedMessage: getTranslatedMessage,
	generateString: generateString,
	handleSubcribePaymentRequest: handleSubcribePaymentRequest,
	paymentWithSavedCard: paymentWithSavedCard
};
