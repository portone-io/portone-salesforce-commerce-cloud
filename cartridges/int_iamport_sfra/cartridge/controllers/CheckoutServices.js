'use strict';

var server = require('server');
server.extend(module.superModule);

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var iamportLogger = require('dw/system/Logger').getLogger('iamport', 'Iamport');
var Site = require('dw/system/Site');

/**
 *  Handle Ajax payment (and billing) form submit
 */
/**
 * CheckoutServices-SubmitPayment : The CheckoutServices-SubmitPayment endpoint will submit the payment information and render the checkout place order page allowing the shopper to confirm and place the order
 * @replace Base/CheckoutServices-SubmitPayment
 * @function
 * @memberof CheckoutServices
 * @param {middleware} - server.middleware.https
 * @param {middleware} - csrfProtection.validateAjaxRequest
 * @param {httpparameter} - addressSelector - For Guest shopper: A shipment UUID that contains address that matches the selected address. For returning shopper: ab_<address-name-from-address-book>" of the selected address. For both type of shoppers:  "new" if a brand new address is entered
 * @param {httpparameter} - dwfrm_billing_addressFields_firstName - Input field for the shoppers's first name
 * @param {httpparameter} - dwfrm_billing_addressFields_lastName - Input field for the shoppers's last name
 * @param {httpparameter} - dwfrm_billing_addressFields_address1 - Input field for the shoppers's address 1 - street
 * @param {httpparameter} - dwfrm_billing_addressFields_address2 - Input field for the shoppers's address 2 - street
 * @param {httpparameter} - dwfrm_billing_addressFields_country - Input field for the shoppers's address - country
 * @param {httpparameter} - dwfrm_billing_addressFields_states_stateCode - Input field for the shoppers's address - state code
 * @param {httpparameter} - dwfrm_billing_addressFields_city - Input field for the shoppers's address - city
 * @param {httpparameter} - dwfrm_billing_addressFields_postalCode - Input field for the shoppers's address - postal code
 * @param {httpparameter} - csrf_token - hidden input field CSRF token
 * @param {httpparameter} - localizedNewAddressTitle - label for new address
 * @param {httpparameter} - dwfrm_billing_contactInfoFields_email - Input field for the shopper's email address
 * @param {httpparameter} - dwfrm_billing_contactInfoFields_phone - Input field for the shopper's phone number
 * @param {httpparameter} - dwfrm_billing_paymentMethod - Input field for the shopper's payment method
 * @param {httpparameter} - dwfrm_billing_creditCardFields_cardType - Input field for the shopper's credit card type
 * @param {httpparameter} - dwfrm_billing_creditCardFields_cardNumber - Input field for the shopper's credit card number
 * @param {httpparameter} - dwfrm_billing_creditCardFields_expirationMonth - Input field for the shopper's credit card expiration month
 * @param {httpparameter} - dwfrm_billing_creditCardFields_expirationYear - Input field for the shopper's credit card expiration year
 * @param {httpparameter} - dwfrm_billing_creditCardFields_securityCode - Input field for the shopper's credit card security code
 * @param {category} - sensitive
 * @param {returns} - json
 * @param {serverfunction} - post
 */
server.replace(
    'SubmitPayment',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
	const PaymentManager = require('dw/order/PaymentMgr');
	const HookManager = require('dw/system/HookMgr');
	const Resource = require('dw/web/Resource');
	const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
	const preferences = require('*/cartridge/config/preferences');

	let viewData = {};
	let paymentForm = server.forms.getForm('billing');

        // verify billing form data
	let billingFormErrors = COHelpers.validateBillingForm(paymentForm.addressFields);
	let contactInfoFormErrors = COHelpers.validateFields(paymentForm.contactInfoFields);

	let formFieldErrors = [];
	if (Object.keys(billingFormErrors).length) {
		formFieldErrors.push(billingFormErrors);
	} else {
		viewData.address = {
			firstName: { value: paymentForm.addressFields.firstName.value },
			lastName: { value: paymentForm.addressFields.lastName.value },
			address1: { value: paymentForm.addressFields.address1.value },
			address2: { value: paymentForm.addressFields.address2.value },
			city: { value: paymentForm.addressFields.city.value },
			postalCode: { value: paymentForm.addressFields.postalCode.value },
			countryCode: { value: paymentForm.addressFields.country.value }
		};

		if (Object.prototype.hasOwnProperty.call(paymentForm.addressFields, 'states')) {
			viewData.address.stateCode = { value: paymentForm.addressFields.states.stateCode.value };
		}
	}

	if (Object.keys(contactInfoFormErrors).length) {
		formFieldErrors.push(contactInfoFormErrors);
	} else {
		// If we are on SFRA5 the email is set on the payment form and not from customer data
		if (preferences.SFRA5_ENABLED) {
			viewData.mail = { value: paymentForm.contactInfoFields && paymentForm.contactInfoFields.email && paymentForm.contactInfoFields.email.htmlValue ? paymentForm.contactInfoFields.email.htmlValue : paymentForm.contactInfoFields.email.value };
		}
		viewData.phone = { value: paymentForm.contactInfoFields.phone.value };
	}

	let paymentMethodIdValue = paymentForm.paymentMethod.value;
	if (!PaymentManager.getPaymentMethod(paymentMethodIdValue).paymentProcessor) {
		throw new Error(Resource.msg(
                'error.payment.processor.missing',
                'checkout',
                null
            ));
	}

	let paymentProcessor = PaymentManager.getPaymentMethod(paymentMethodIdValue).getPaymentProcessor();

	let paymentFormResult;
	if (HookManager.hasHook('app.payment.form.processor.' + paymentProcessor.ID.toLowerCase())) {
		paymentFormResult = HookManager.callHook('app.payment.form.processor.' + paymentProcessor.ID.toLowerCase(),
                'processForm',
                req,
                paymentForm,
                viewData
            );
	} else {
		paymentFormResult = HookManager.callHook('app.payment.form.processor.default_form_processor', 'processForm');
	}

	if (paymentFormResult.error && paymentFormResult.fieldErrors) {
		formFieldErrors.push(paymentFormResult.fieldErrors);
	}

	if (formFieldErrors.length || paymentFormResult.serverErrors) {
            // respond with form data and errors
		res.json({
			form: paymentForm,
			fieldErrors: formFieldErrors,
			serverErrors: paymentFormResult.serverErrors ? paymentFormResult.serverErrors : [],
			error: true
		});
		return next();
	}

	res.setViewData(paymentFormResult.viewData);

	this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
		const BasketMgr = require('dw/order/BasketMgr');
		const HookMgr = require('dw/system/HookMgr');
		const PaymentMgr = require('dw/order/PaymentMgr');
		const Transaction = require('dw/system/Transaction');
		const AccountModel = require('*/cartridge/models/account');
		const OrderModel = require('*/cartridge/models/order');
		const URLUtils = require('dw/web/URLUtils');
		const Locale = require('dw/util/Locale');
		const basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
		const hooksHelper = require('*/cartridge/scripts/helpers/hooks');
		const validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');

		let currentBasket = BasketMgr.getCurrentBasket();
		let billingData = res.getViewData();
		let selectedPaymentMethod = req.form.paymentOption
		.toString().trim().split('&');

		// save the selected payment method id to the session.
		// It will be retrieved later to prepare the payment resources to request for payment
		req.session.privacyCache.set('iamportPaymentMethod',
			selectedPaymentMethod[0]);

		// save the payment method name to the current basket which will be transferred to the order object
		if (HookMgr.hasHook('app.payment.processor.iamport')) {
			HookMgr.callHook('app.payment.processor.iamport',
				'updatePaymentMethodOnBasket',
				selectedPaymentMethod[1],
				currentBasket
			);
		}

		if (!currentBasket) {
			delete billingData.paymentInformation;

			res.json({
				error: true,
				cartError: true,
				fieldErrors: [],
				serverErrors: [],
				redirectUrl: URLUtils.url('Cart-Show').toString()
			});
			return;
		}

		let validatedProducts = validationHelpers.validateProducts(currentBasket);
		if (validatedProducts.error) {
			delete billingData.paymentInformation;

			res.json({
				error: true,
				cartError: true,
				fieldErrors: [],
				serverErrors: [],
				redirectUrl: URLUtils.url('Cart-Show').toString()
			});
			return;
		}

		let billingAddress = currentBasket.billingAddress;
		let billingForm = server.forms.getForm('billing');
		let paymentMethodID = billingData.paymentMethod.value;
		let result;

		billingForm.creditCardFields.cardNumber.htmlValue = '';
		billingForm.creditCardFields.securityCode.htmlValue = '';

		Transaction.wrap(function () {
			if (!billingAddress) {
				billingAddress = currentBasket.createBillingAddress();
			}

			billingAddress.setFirstName(billingData.address.firstName.value);
			billingAddress.setLastName(billingData.address.lastName.value);
			billingAddress.setAddress1(billingData.address.address1.value);
			billingAddress.setAddress2(billingData.address.address2.value);
			billingAddress.setCity(billingData.address.city.value);
			billingAddress.setPostalCode(billingData.address.postalCode.value);
			if (Object.prototype.hasOwnProperty.call(billingData.address, 'stateCode')) {
				billingAddress.setStateCode(billingData.address.stateCode.value);
			}
			billingAddress.setCountryCode(billingData.address.countryCode.value);
			billingAddress.setPhone(billingData.phone.value);

			if (preferences.SFRA5_ENABLED) {
				currentBasket.setCustomerEmail(billingData.mail.value);
			}
		});


            // if there is no selected payment option and balance is greater than zero
		if (!paymentMethodID && currentBasket.totalGrossPrice.value > 0) {
			let noPaymentMethod = {};

			noPaymentMethod[billingData.paymentMethod.htmlName] =
                    Resource.msg('error.no.selected.payment.method', 'payment', null);

			delete billingData.paymentInformation;

			res.json({
				form: billingForm,
				fieldErrors: [noPaymentMethod],
				serverErrors: [],
				error: true
			});
			return;
		}

		let processor = PaymentMgr.getPaymentMethod(paymentMethodID).getPaymentProcessor();

            // check to make sure there is a payment processor
		if (!processor) {
			throw new Error(Resource.msg(
                    'error.payment.processor.missing',
                    'checkout',
                    null
                ));
		}

		if (HookMgr.hasHook('app.payment.processor.' + processor.ID.toLowerCase())) {
			result = HookMgr.callHook('app.payment.processor.' + processor.ID.toLowerCase(),
                    'Handle',
                    currentBasket,
                    billingData.paymentInformation,
                    paymentMethodID,
                    req
                );
		} else {
			result = HookMgr.callHook('app.payment.processor.default', 'Handle');
		}

            // need to invalidate credit card fields
		if (result.error) {
			delete billingData.paymentInformation;

			res.json({
				form: billingForm,
				fieldErrors: result.fieldErrors,
				serverErrors: result.serverErrors,
				error: true
			});
			return;
		}

		if (HookMgr.hasHook('app.payment.form.processor.' + processor.ID.toLowerCase())) {
			HookMgr.callHook('app.payment.form.processor.' + processor.ID.toLowerCase(),
                    'savePaymentInformation',
                    req,
                    currentBasket,
                    billingData
                );
		} else {
			HookMgr.callHook('app.payment.form.processor.default', 'savePaymentInformation');
		}

            // Calculate the basket
		Transaction.wrap(function () {
			basketCalculationHelpers.calculateTotals(currentBasket);
		});

            // Re-calculate the payments.
		let calculatedPaymentTransaction = COHelpers.calculatePaymentTransaction(
                currentBasket
            );

		if (calculatedPaymentTransaction.error) {
			res.json({
				form: paymentForm,
				fieldErrors: [],
				serverErrors: [Resource.msg('error.technical', 'checkout', null)],
				error: true
			});
			return;
		}

		let usingMultiShipping = req.session.privacyCache.get('usingMultiShipping');
		if (usingMultiShipping === true && currentBasket.shipments.length < 2) {
			req.session.privacyCache.set('usingMultiShipping', false);
			usingMultiShipping = false;
		}

		hooksHelper('app.customer.subscription', 'subscribeTo', [paymentForm.subscribe.checked, currentBasket.customerEmail], function () {});

		let currentLocale = Locale.getLocale(req.locale.id);

		let basketModel = new OrderModel(currentBasket, {
			usingMultiShipping: usingMultiShipping,
			countryCode: currentLocale.country,
			containerView: 'basket'
		});

		let accountModel = new AccountModel(req.currentCustomer);
		let renderedStoredPaymentInstrument = COHelpers.getRenderedPaymentInstruments(
                req,
                accountModel
            );

		delete billingData.paymentInformation;

		res.json({
			renderedPaymentInstruments: renderedStoredPaymentInstrument,
			customer: accountModel,
			order: basketModel,
			form: billingForm,
			error: false,
			selectedPaymentMethod: selectedPaymentMethod[1]
		});
	});

	return next();
}
);

/**
 * CheckoutServices-PlaceOrder : The CheckoutServices-PlaceOrder endpoint places the order
 * This endpoint has been modified to just create an order
 * @replace Base/CheckoutServices-PlaceOrder
 * @function
 * @memberof CheckoutServices
 * @param {middleware} - server.middleware.https
 * @param {category} - sensitive
 * @param {returns} - json
 * @param {serverfunction} - post
 */
server.replace('PlaceOrder', server.middleware.https, function (req, res, next) {
	const BasketMgr = require('dw/order/BasketMgr');
	const Resource = require('dw/web/Resource');
	const Transaction = require('dw/system/Transaction');
	const URLUtils = require('dw/web/URLUtils');
	const OrderMgr = require('dw/order/OrderMgr');
	const basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
	const hooksHelper = require('*/cartridge/scripts/helpers/hooks');
	const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
	const validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');
	const iamportHelpers = require('*/cartridge/scripts/helpers/iamportHelpers');
	const iamportServices = require('*/cartridge/scripts/service/iamportService');
	const CustomError = require('*/cartridge/errors/customError');
	var pgValidators = require('*/cartridge/config/pgValidators');
	var iamportConstants = require('*/cartridge/constants/iamportConstants');
	var addressHelpers = require('*/cartridge/scripts/helpers/addressHelpers');
	let customError;

	let currentBasket = BasketMgr.getCurrentBasket();

	if (!currentBasket) {
		res.json({
			error: true,
			cartError: true,
			fieldErrors: [],
			serverErrors: [],
			redirectUrl: URLUtils.url('Cart-Show').toString()
		});
		return next();
	}

	let validatedProducts = validationHelpers.validateProducts(currentBasket);
	if (validatedProducts.error) {
		res.json({
			error: true,
			cartError: true,
			fieldErrors: [],
			serverErrors: [],
			redirectUrl: URLUtils.url('Cart-Show').toString()
		});
		return next();
	}

	if (req.session.privacyCache.get('fraudDetectionStatus')) {
		res.json({
			error: true,
			cartError: true,
			redirectUrl: URLUtils.url('Error-ErrorCode', 'err', '01').toString(),
			errorMessage: Resource.msg('error.technical', 'checkout', null),
			serverErrors: [Resource.msg('error.technical', 'checkout', null)]
		});

		return next();
	}

	let validationOrderStatus = hooksHelper('app.validate.order', 'validateOrder', currentBasket, require('*/cartridge/scripts/hooks/validateOrder').validateOrder);
	if (validationOrderStatus.error) {
		res.json({
			error: true,
			errorMessage: validationOrderStatus.message,
			serverErrors: [Resource.msg('error.technical', 'checkout', null)],
			redirectUrl: URLUtils.url('Cart-Show').toString()
		});
		return next();
	}

    // Check to make sure there is a shipping address
	if (currentBasket.defaultShipment.shippingAddress === null) {
		res.json({
			error: true,
			errorStage: {
				stage: 'shipping',
				step: 'address'
			},
			errorMessage: Resource.msg('error.no.shipping.address', 'checkout', null)
		});
		return next();
	}

    // Check to make sure billing address exists
	if (!currentBasket.billingAddress) {
		res.json({
			error: true,
			errorStage: {
				stage: 'payment',
				step: 'billingAddress'
			},
			errorMessage: Resource.msg('error.no.billing.address', 'checkout', null),
			serverErrors: [Resource.msg('error.technical', 'checkout', null)]
		});
		return next();
	}

    // Calculate the basket
	Transaction.wrap(function () {
		basketCalculationHelpers.calculateTotals(currentBasket);
	});

    // Re-validates existing payment instruments
	let validPayment = COHelpers.validatePayment(req, currentBasket);
	if (validPayment.error) {
		res.json({
			error: true,
			errorStage: {
				stage: 'payment',
				step: 'paymentInstrument'
			},
			errorMessage: Resource.msg('error.payment.not.valid', 'checkout', null),
			serverErrors: [Resource.msg('error.technical', 'checkout', null)]
		});
		return next();
	}

    // Re-calculate the payments.
	let calculatedPaymentTransactionTotal = COHelpers.calculatePaymentTransaction(currentBasket);
	if (calculatedPaymentTransactionTotal.error) {
		res.json({
			error: true,
			errorMessage: Resource.msg('error.technical', 'checkout', null),
			serverErrors: [Resource.msg('error.technical', 'checkout', null)]
		});
		return next();
	}

    // Creates a new order.
	let order = COHelpers.createOrder(currentBasket);
	if (!order) {
		res.json({
			error: true,
			errorMessage: Resource.msg('error.technical', 'checkout', null),
			serverErrors: [Resource.msg('error.technical', 'checkout', null)]
		});
		return next();
	}
	// get the store id
	var paymentGatewayID = Site.getCurrent().getCustomPreferenceValue(iamportConstants.PG_ATTRIBUTE_ID)
		|| iamportConstants.PG_DEFAULT_FALLBACK;
	var paymentGateway = pgValidators[paymentGatewayID];
	var storeID = Site.getCurrent().getCustomPreferenceValue(paymentGateway.generalStoreID);
	var selectedPG = !empty(storeID) ? paymentGatewayID.value + '.' + storeID : paymentGatewayID.value;
	// retrieved the payment method id from the session
	let selectedPaymentMethod = req.session.privacyCache.get('iamportPaymentMethod');
	let generalPaymentWebhookUrl = URLUtils.abs('Iamport-SfNotifyHook').toString();
	let mobileRedirectUrl = URLUtils.abs('Order-GetConfirmation', 'token', encodeURIComponent(order.orderToken)).toString();
	let paymentResources = iamportHelpers.preparePaymentResources(order, selectedPaymentMethod, generalPaymentWebhookUrl, mobileRedirectUrl, selectedPG);

	// Pre-register payment before the client call for forgery protection
	let paymentRegistered = iamportServices.registerAndValidatePayment.call({
		merchant_uid: paymentResources.merchant_uid,
		amount: paymentResources.amount
	});

	// when Iamport server call (service) fails
	// Expected Iamport server error codes
	if (!paymentRegistered.isOk()) {
		const iamportResponseError = JSON.parse(paymentRegistered.errorMessage);

		customError = new CustomError({ status: iamportResponseError.code });

		iamportLogger.error('Payment registration and validation failed: {0}.', JSON.stringify(paymentRegistered.errorMessage));

		COHelpers.recreateCurrentBasket(order, 'Order failed', customError.note);

		res.json({
			error: true,
			paymentError: true,
			paymentErrorCode: paymentRegistered.getError(),
			orderID: order.orderNo,
			orderToken: order.orderToken,
			requestPayFailureUrl: URLUtils.url('Checkout-HandlePaymentRequestFailure').toString(),
			paymentResources: paymentResources,
			errorStage: {
				stage: 'placeOrder',
				step: 'paymentInstrument'
			},
			serverErrors: [customError]
		});
		return next();
	} else if (paymentRegistered.getObject().message) {
		iamportLogger.error('Payment registration and validation failed: {0}.', JSON.stringify(paymentRegistered));
		COHelpers.recreateCurrentBasket(order,
			'Order failed',
			Resource.msgf('error.payment.forgery', 'checkout', null, paymentResources.merchant_uid));

		res.json({
			error: true,
			errorStage: {
				stage: 'placeOrder',
				step: 'paymentInstrument'
			},
			errorMessage: Resource.msgf('error.payment.forgery', 'checkout', null, '00002853' || paymentResources.merchant_uid)
		});
		return next();
	}

	// place the order with saved credit card.
	var orderPaymentInstrumentObj = order.paymentInstruments.length > 0 ? order.paymentInstruments[0] : null;
	if (req.currentCustomer.raw.authenticated && req.currentCustomer.raw.registered && orderPaymentInstrumentObj && orderPaymentInstrumentObj.creditCardToken) {
		// Handles payment authorization
		var handlePaymentResult = COHelpers.handlePayments(order, order.orderNo);
		if (handlePaymentResult.error) {
			res.json({
				error: true,
				errorMessage: Resource.msg('error.technical', 'checkout', null)
			});
			return next();
		}

		// Making a payment with saved billing key(customer uid)
		var sucessPayment = iamportHelpers.paymentWithSavedCard(paymentResources, orderPaymentInstrumentObj);

		// if saved billing key(customer uid) is not register in Iamport server and Payment is not made as success with saved billing key.
		if (sucessPayment.error) {
			Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
			res.json({
				error: true,
				errorMessage: Resource.msg('error.technical', 'checkout', null)
			});
			return next();
		}

		// get iamport uid from success payment.
		var paymentID = sucessPayment.imp_uid;

		// get order payment information
		let paymentData = iamportServices.getPaymentInformation.call({
			paymentID: paymentID
		});

		if (!paymentData.isOk()) {
			iamportLogger.error('Server failed to retrieve payment data for "{0}": {1}.', paymentID, JSON.stringify(paymentData));
			customError = new CustomError({ status: paymentData.getError() });

			COHelpers.recreateCurrentBasket(order, 'Order failed', customError.note);

			res.json({
				error: true,
				cartError: true,
				redirectUrl: URLUtils.url('Cart-Show', 'err', paymentData.getError().toString()).toString()
			});
			return next();
		}

		// save the payment id in a custom attribute on the Order object
		let paymentResponse = paymentData.getObject().response;
		let paymentId = paymentResponse.imp_uid;

		hooksHelper('app.payment.processor.iamport',
			'updatePaymentIdOnOrder',
			paymentId,
			order,
			require('*/cartridge/scripts/hooks/payment/processor/iamportPayments').updatePaymentIdOnOrder
		);

		var iamportFraudDetectionStatus = hooksHelper('app.fraud.detection', 'fraudDetection', paymentData, order, require('*/cartridge/scripts/hooks/fraudDetection').fraudDetection);
		if (iamportFraudDetectionStatus.status === 'fail') {
			Transaction.wrap(function () {
				OrderMgr.failOrder(order, true);
				COHelpers.addOrderNote(order,
					Resource.msg('order.note.payment.incomplete.subject', 'order', null),
					iamportFraudDetectionStatus.errorMessage);
			});

			// fraud detection failed
			req.session.privacyCache.set('fraudDetectionStatus', true);

			res.json({
				error: true,
				cartError: true,
				redirectUrl: URLUtils.url('Error-ErrorCode', 'err', iamportFraudDetectionStatus.errorCode).toString(),
				errorMessage: Resource.msg('error.technical', 'checkout', null)
			});

			return next();
		}

		// Places the order
		let placeOrderResult = COHelpers.placeOrder(order, iamportFraudDetectionStatus);
		if (placeOrderResult.error) {
			res.json({
				error: true,
				errorMessage: Resource.msg('error.technical', 'checkout', null)
			});
			return next();
		}

		if (req.currentCustomer.addressBook) {
			// save all used shipping addresses to address book of the logged in customer
			var allAddresses = addressHelpers.gatherShippingAddresses(order);
			allAddresses.forEach(function (address) {
				if (!addressHelpers.checkIfAddressStored(address, req.currentCustomer.addressBook.addresses)) {
					addressHelpers.saveAddress(address, req.currentCustomer, addressHelpers.generateAddressName(address));
				}
			});
		}

		// Reset usingMultiShip after successful Order placement
		req.session.privacyCache.set('usingMultiShipping', false);

		// TODO: Exposing a direct route to an Order, without at least encoding the orderID
		//  is a serious PII violation.  It enables looking up every customers orders, one at a
		//  time.
		res.json({
			error: false,
			orderID: order.orderNo,
			orderToken: order.orderToken,
			placedOrderWithSavedCard: true,
			continueUrl: URLUtils.url('Order-Confirm').toString()
		});
		return next();
	}
    // TODO: Exposing a direct route to an Order, without at least encoding the orderID
    //  is a serious PII violation.  It enables looking up every customers orders, one at a
    //  time.
	res.json({
		error: false,
		orderID: order.orderNo,
		orderToken: order.orderToken,
		placedOrderWithSavedCard: false,
		validationUrl: URLUtils.url('CheckoutServices-ValidatePlaceOrder').toString(),
		requestPayFailureUrl: URLUtils.url('Checkout-HandlePaymentRequestFailure').toString(),
		cancelUrl: URLUtils.url('Checkout-HandleCancel').toString(),
		paymentResources: paymentResources
	});

	return next();
});

/**
 * CheckoutServices-ValidatePlaceOrder : The CheckoutServices-ValidatePlaceOrder endpoint places the order
 * @replace Base/CheckoutServices-ValidatePlaceOrder
 * @function
 * @memberof CheckoutServices
 * @param {middleware} - server.middleware.https
 * @param {category} - sensitive
 * @param {returns} - json
 * @param {serverfunction} - post
 */
server.post('ValidatePlaceOrder', server.middleware.https, function (req, res, next) {
	const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
	const hooksHelper = require('*/cartridge/scripts/helpers/hooks');
	const OrderMgr = require('dw/order/OrderMgr');
	const Resource = require('dw/web/Resource');
	const URLUtils = require('dw/web/URLUtils');
	const Transaction = require('dw/system/Transaction');
	const BasketMgr = require('dw/order/BasketMgr');
	const HookMgr = require('dw/system/HookMgr');
	const iamportServices = require('*/cartridge/scripts/service/iamportService');
	const iamportHelpers = require('*/cartridge/scripts/helpers/iamportHelpers');
	const addressHelpers = require('*/cartridge/scripts/helpers/addressHelpers');
	const CustomError = require('*/cartridge/errors/customError');
	let customError;

	let paymentInformation = req.form;
	if (empty(paymentInformation)) {
		iamportLogger.error('Payment must contain a unique id and and an order id {0}.', paymentInformation.error);
		return next();
	}

	let orderID = paymentInformation.merchant_uid;
	let order = OrderMgr.getOrder(orderID);

	let currentBasket = null;
	try {
		Transaction.wrap(function () {
			currentBasket = BasketMgr.createBasketFromOrder(order);
		});
	} catch (e) {
		iamportLogger.error(e);
	}

	if (!currentBasket) {
		res.json({
			error: true,
			cartError: true,
			fieldErrors: [],
			serverErrors: [],
			redirectUrl: URLUtils.url('Cart-Show').toString()
		});
		return next();
	}

	// Handles payment authorization
	let handlePaymentResult = COHelpers.handlePayments(order, order.orderNo);

	if (handlePaymentResult.error) {
		res.json({
			error: true,
			errorMessage: Resource.msg('error.technical', 'checkout', null),
			errorStage: {
				stage: 'payment',
				step: 'paymentInstrument'
			}
		});
		return next();
	}

	if (req.currentCustomer.addressBook) {
        // save all used shipping addresses to address book of the logged in customer
		let allAddresses = addressHelpers.gatherShippingAddresses(order);
		allAddresses.forEach(function (address) {
			if (!addressHelpers.checkIfAddressStored(address, req.currentCustomer.addressBook.addresses)) {
				addressHelpers.saveAddress(address, req.currentCustomer, addressHelpers.generateAddressName(address));
			}
		});
	}

	let paymentID = paymentInformation.imp_uid;
	let paymentData = iamportServices.getPaymentInformation.call({
		paymentID: paymentID
	});

	if (!paymentData.isOk()) {
		iamportLogger.error('Server failed to retrieve payment data for "{0}": {1}.', paymentID, JSON.stringify(paymentData));
		customError = new CustomError({ status: paymentData.getError() });

		COHelpers.recreateCurrentBasket(order, 'Order failed', customError.note);

		res.json({
			error: true,
			cartError: true,
			redirectUrl: URLUtils.url('Cart-Show', 'err', paymentData.getError().toString()).toString()
		});
		return next();
	}

	// save the payment id in a custom attribute on the Order object
	let paymentResponse = paymentData.getObject().response;
	let paymentId = paymentResponse.imp_uid;
	hooksHelper('app.payment.processor.iamport',
		'updatePaymentIdOnOrder',
		paymentId,
		order,
		require('*/cartridge/scripts/hooks/payment/processor/iamportPayments').updatePaymentIdOnOrder
	);

	var iamportFraudDetectionStatus = hooksHelper('app.fraud.detection', 'fraudDetection', paymentData, order, require('*/cartridge/scripts/hooks/fraudDetection').fraudDetection);
	if (iamportFraudDetectionStatus.status === 'fail') {
		Transaction.wrap(function () {
			OrderMgr.failOrder(order, true);
			COHelpers.addOrderNote(order,
				Resource.msg('order.note.payment.incomplete.subject', 'order', null),
				iamportFraudDetectionStatus.errorMessage);
		});
        // fraud detection failed
		req.session.privacyCache.set('fraudDetectionStatus', true);

		res.json({
			error: true,
			cartError: true,
			redirectUrl: URLUtils.url('Error-ErrorCode', 'err', iamportFraudDetectionStatus.errorCode).toString(),
			errorMessage: Resource.msg('error.technical', 'checkout', null)
		});

		return next();
	}

	let validationResponse = {
		error: false,
		orderID: order.orderNo,
		orderToken: order.orderToken,
		continueUrl: URLUtils.url('Order-Confirm').toString()
	};

	let vbankExpiration = COHelpers.getTimeWithPreferredTimeZone(paymentResponse.vbank_date);
	let vbankIssuedAt = COHelpers.getTimeWithPreferredTimeZone(paymentResponse.vbank_issued_at);

	if (paymentResponse.pay_method === 'vbank') {
		Object.assign(validationResponse, {
			vbank: true,
			vbankPayload: {
				vbankName: paymentResponse.vbank_name,
				vbankNumber: paymentResponse.vbank_num,
				vbankExpiration: vbankExpiration,
				vbankCode: paymentResponse.vbank_code,
				vbankIssuedAt: vbankIssuedAt,
				vbankHolder: paymentResponse.vbank_holder
			}
		});

		if (HookMgr.hasHook('app.payment.processor.iamport')) {
			HookMgr.callHook('app.payment.processor.iamport',
				'updateVbankOnOrder',
				validationResponse.vbank,
				validationResponse.vbankPayload,
				order
			);
		}

		let mappedPaymentInfo = iamportHelpers.mapVbankResponseForLogging(paymentData);
		iamportLogger.debug('Virtual Payment Information: {0}.', JSON.stringify(mappedPaymentInfo));

		res.json(validationResponse);
		return next();
	}

	// Places the order
	let placeOrderResult = COHelpers.placeOrder(order, iamportFraudDetectionStatus);
	if (placeOrderResult.error) {
		res.json({
			error: true,
			errorMessage: Resource.msg('error.technical', 'checkout', null)
		});
		return next();
	}

	// Reset usingMultiShip after successful Order placement
	req.session.privacyCache.set('usingMultiShipping', false);

	let mappedPaymentInfo = iamportHelpers.mapPaymentResponseForLogging(paymentData);
	iamportLogger.debug('Payment Information: {0}.', JSON.stringify(mappedPaymentInfo));

	res.json(validationResponse);
	return next();
});

module.exports = server.exports();
