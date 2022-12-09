'use strict';

const shippingHelpers = require('base/checkout/shipping');
const formHelpers = require('base/checkout/formErrors');
const scrollAnimate = require('base/components/scrollAnimate');
const baseCheckout = require('base/checkout/checkout');
const iamportPayment = require('../iamport/paymentLoader');
const billingHelpers = require('./billing');

/**
 * Create the jQuery Checkout Plugin.
 *
 * This jQuery plugin will be registered on the dom element in checkout.isml with the
 * id of "checkout-main".
 *
 * The checkout plugin will handle the different state the user interface is in as the user
 * progresses through the varying forms such as shipping and payment.
 *
 * Billing info and payment info are used a bit synonymously in this code.
 *
 */
(function ($) {
    $.fn.checkout = function () { // eslint-disable-line
	let plugin = this;

	//
	// Collect form data from user input
	//
	let formData = {
		// Shipping Address
		shipping: {},

		// Billing Address
		billing: {},

		// Payment
		payment: {},

		// Gift Codes
		giftCode: {}
	};

	//
	// The different states/stages of checkout
	//
	let checkoutStages = [
		'shipping',
		'payment',
		'placeOrder',
		'submitted'
	];

	/**
	 * Updates the URL to determine stage
	 * @param {number} currentStage - The current stage the user is currently on in the checkout
	 */
	function updateUrl(currentStage) {
		history.pushState(
                checkoutStages[currentStage],
                document.title,
                location.pathname
                + '?stage='
                + checkoutStages[currentStage]
                + '#'
                + checkoutStages[currentStage]
            );
	}

	//
	// Local member methods of the Checkout plugin
	//
	let members = {

		// initialize the currentStage variable for the first time
		currentStage: 0,

		/**
		 * Set or update the checkout stage (AKA the shipping, billing, payment, etc... steps)
		 * @returns {Object} a promise
		 */
		updateStage: function () {
			let stage = checkoutStages[members.currentStage];
                let defer = $.Deferred(); // eslint-disable-line

			if (stage === 'shipping') {
				//
				// Clear Previous Errors
				//
				formHelpers.clearPreviousErrors('.shipping-form');
				$('body').trigger('checkout:enableButton', '.next-step-button button');

				//
				// Submit the Shipping Address Form
				//
				let isMultiShip = $('#checkout-main').hasClass('multi-ship');
				let formSelector = isMultiShip ?
                        '.multi-shipping .active form' : '.single-shipping .shipping-form';
				let form = $(formSelector);

				if (isMultiShip && form.length === 0) {
					// disable the next:Payment button here
					$('body').trigger('checkout:disableButton', '.next-step-button button');
					// in case the multi ship form is already submitted
					let url = $('#checkout-main').attr('data-checkout-get-url');
					$.ajax({
						url: url,
						method: 'GET',
						success: function (data) {
                                // enable the next:Payment button here
							$('body').trigger('checkout:enableButton', '.next-step-button button');
							if (!data.error) {
								$('body').trigger('checkout:updateCheckoutView',
                                { order: data.order, customer: data.customer });
								defer.resolve();
							} else if (data.message && $('.shipping-error .alert-danger').length < 1) {
								let errorMsg = data.message;
								let errorHtml = '<div class="alert alert-danger alert-dismissible valid-cart-error ' +
                                        'fade show" role="alert">' +
                                        '<button type="button" class="close" data-dismiss="alert" aria-label="Close">' +
                                        '<span aria-hidden="true">&times;</span>' +
                                        '</button>' + errorMsg + '</div>';
								$('.shipping-error').append(errorHtml);
								scrollAnimate($('.shipping-error'));
								defer.reject();
							} else if (data.redirectUrl) {
								window.location.href = data.redirectUrl;
							}
						},
						error: function () {
                                // enable the next:Payment button here
							$('body').trigger('checkout:enableButton', '.next-step-button button');
                                // Server error submitting form
							defer.reject();
						}
					});
				} else {
					let shippingFormData = form.serialize();
					$('body').trigger('checkout:serializeShipping', {
						form: form,
						data: shippingFormData,
						callback: function (data) {
							shippingFormData = data;
						}
					});
					// Not disable the next:Payment button here
					$('body').trigger('checkout:enableButton', '.next-step-button button');
					$.ajax({
						url: form.attr('action'),
						type: 'post',
						data: shippingFormData,
						success: function (data) {
								// Don't enable the next-step-button when moving to payment method
								// $('body').trigger('checkout:enableButton', '.next-step-button button');
							if (data.customer && data.customer.profile && data.customer.profile.email) {
								$('.order-summary-email').text(data.customer.profile.email);
							}

							let hasPaymentMethodSelected = $('.payment-method:input:radio:checked').length > 0;
							if (hasPaymentMethodSelected) {
								$('body').trigger('checkout:enableButton', '.next-step-button button');
							}
							shippingHelpers.methods.shippingFormResponse(defer, data);
						},
						error: function (err) {
							// enable the next:Payment button here
							$('body').trigger('checkout:enableButton', '.next-step-button button');
							if (err.responseJSON && err.responseJSON.redirectUrl) {
								window.location.href = err.responseJSON.redirectUrl;
							}
							// Server error submitting form
							defer.reject(err.responseJSON);
						}
					});
				}
				return defer;
			} else if (stage === 'payment') {
				// Clear Previous Errors
				formHelpers.clearPreviousErrors('.payment-form');
				$('body').trigger('checkout:enableButton', '.next-step-button button');
				//
				// Submit the Billing Address Form
				//

				// Recover the mail value in the input to avoid it clears when user go back
				var form = $('form[name=dwfrm_billing]');
				$('input[name$=_email]', form).val($('#dwfrm_billing .contact-info-block #email').val());

				// Set the email value on the placeOrder stage
				$('.order-summary-email').text($('#dwfrm_billing .contact-info-block #email').val());


				let billingAddressForm = $('#dwfrm_billing .billing-address-block :input').serialize();

				$('body').trigger('checkout:serializeBilling', {
					form: $('#dwfrm_billing .billing-address-block'),
					data: billingAddressForm,
					callback: function (data) {
						if (data) {
							billingAddressForm = data;
						}
					}
				});

				let contactInfoForm = $('#dwfrm_billing .contact-info-block :input').serialize();

				$('body').trigger('checkout:serializeBilling', {
					form: $('#dwfrm_billing .contact-info-block'),
					data: contactInfoForm,
					callback: function (data) {
						if (data) {
							contactInfoForm = data;
						}
					}
				});

				// let emailUserInfo = $('#dwfrm_billing .contact-info-block :input').serialize();

				let activeTabId = $('.tab-pane.active').attr('id');
				let paymentInfoSelector = '#dwfrm_billing .' + activeTabId + ' .payment-form-fields :input';
				let paymentInfoForm = $(paymentInfoSelector).serialize();

				$('body').trigger('checkout:serializeBilling', {
					form: $(paymentInfoSelector),
					data: paymentInfoForm,
					callback: function (data) {
						if (data) {
							paymentInfoForm = data;
						}
					}
				});

				let paymentForm = billingAddressForm + '&' + contactInfoForm + '&' + paymentInfoForm;

				if ($('.data-checkout-stage').data('customer-type') === 'registered') {
					// if payment method is credit card
					if ($('.payment-information').data('payment-method-id') === 'CREDIT_CARD') {
						if (!($('.payment-information').data('is-new-payment'))) {
							let cvvCode = $('.saved-payment-instrument.' +
                                    'selected-payment .saved-payment-security-code').val();

							if (cvvCode === '') {
								let cvvElement = $('.saved-payment-instrument.' +
                                        'selected-payment ' +
                                        '.form-control');
								cvvElement.addClass('is-invalid');
								scrollAnimate(cvvElement);
								defer.reject();
								return defer;
							}

							let $savedPaymentInstrument = $('.saved-payment-instrument' +
                                    '.selected-payment'
                                );

							paymentForm += '&storedPaymentUUID=' +
                                    $savedPaymentInstrument.data('uuid');

							paymentForm += '&securityCode=' + cvvCode;
						}
					}
				}
				// disable the next:Place Order button here
				$('body').trigger('checkout:disableButton', '.next-step-button button');

				$.ajax({
					url: $('#dwfrm_billing').attr('action'),
					method: 'POST',
					data: paymentForm,
					success: function (data) {
						// enable the next:Place Order button here
						$('body').trigger('checkout:enableButton', '.next-step-button button');
						// look for field validation errors
						if (data.error) {
							if (data.fieldErrors.length) {
								data.fieldErrors.forEach(function (error) {
									if (Object.keys(error).length) {
										formHelpers.loadFormErrors('.payment-form', error);
									}
								});
							}

							if (data.serverErrors.length) {
								data.serverErrors.forEach(function (error) {
									$('.error-message').show();
									$('.error-message-text').text(error);
									scrollAnimate($('.error-message'));
								});
							}

							if (data.cartError) {
								window.location.href = data.redirectUrl;
							}

							defer.reject();
						} else {
							// populate the payment method in the payment summary
							iamportPayment.renderSelectedPaymentMethod(data.selectedPaymentMethod);
							// Populate the Address Summary
							$('body').trigger('checkout:updateCheckoutView',
                                    { order: data.order, customer: data.customer });

							if (data.renderedPaymentInstruments) {
								$('.stored-payments').empty().html(
                                        data.renderedPaymentInstruments
                                    );
							}

							if (data.customer.registeredUser
                                    && data.customer.customerPaymentInstruments.length
                                ) {
								$('.cancel-new-payment').removeClass('checkout-hidden');
							}

							scrollAnimate();
							defer.resolve(data);
						}
					},
					error: function (err) {
						// enable the next:Place Order button here
						$('body').trigger('checkout:enableButton', '.next-step-button button');
						if (err.responseJSON && err.responseJSON.redirectUrl) {
							window.location.href = err.responseJSON.redirectUrl;
						}
					}
				});

				return defer;
			} else if (stage === 'placeOrder') {
				// disable the placeOrder button here
				$('body').trigger('checkout:disableButton', '.next-step-button button');
				$('.payments-error .alert-danger').remove();
				$.spinner().start();
				$.ajax({
					url: $('.place-order').data('action'),
					method: 'POST',
					success: function (data) {
						// not enable the placeOrder button here in order to user do only one click
						// $('body').trigger('checkout:enableButton', '.next-step-button button');
						// Response of CheckoutServices-PlaceOrder
						if (data.error) {
							// Response success but there is a request error
							$('body').trigger('checkout:enableButton', '.next-step-button button');
							if (data.cartError) {
								window.location.href = data.redirectUrl;
								defer.reject();
							} else if (data.paymentError) {
									// Any payment error when trying to create it
								data.paymentResources.paymentError = true;
								data.paymentResources.error_code = data.paymentErrorCode;
								if (data.serverErrors) {
									data.paymentResources.error_msg = data.serverErrors[0].message;
								}

								let payload = {
									paymentError: true,
									paymentErrorCode: data.paymentErrorCode,
									paymentResources: data.paymentResources,
									orderToken: data.orderToken,
									requestPayFailureUrl: data.requestPayFailureUrl,
									merchantID: data.paymentResources.merchant_uid
								};
								iamportPayment.generalPayment(payload);
							} else {
								$.spinner().stop();
								// go to appropriate stage and display error message
								defer.reject(data);
							}
						} else {
							// let continueUrl = data.continueUrl;
							// let urlParams = {
							// 	ID: data.orderID,
							// 	token: data.orderToken
							// };

							// continueUrl += (continueUrl.indexOf('?') !== -1 ? '&' : '?') +
							// 	Object.keys(urlParams).map(function (key) {
							// 		return key + '=' + encodeURIComponent(urlParams[key]);
							// 	}).join('&');

							// window.location.href = continueUrl;
							// defer.resolve(data);
							if (data.paymentResources) {
								var payload = {
									paymentResources: data.paymentResources,
									validationUrl: data.validationUrl,
									cancelUrl: data.cancelUrl,
									orderToken: data.orderToken,
									requestPayFailureUrl: data.requestPayFailureUrl,
									merchantID: data.paymentResources.merchant_uid
								};
								iamportPayment.generalPayment(payload);
							}
						}
					},
					error: function (error) {
						$.spinner().stop();
						let errorMsg = error.responseJSON.message;
						let paymentErrorHtml = '<div class="alert alert-danger alert-dismissible '
                            + 'fade show" role="alert">'
                            + '<button type="button" class="close" data-dismiss="alert" aria-label="Close">'
                            + '<span aria-hidden="true">&times;</span>'
                            + '</button>' + errorMsg + '</div>';
						$('.payments-error').append(paymentErrorHtml);
						scrollAnimate($('.payments-error'));
						// Enable the placeOrder button here in order to have the user trying the action again
						$('body').trigger('checkout:enableButton', $('.next-step-button button'));
						defer.reject();
					}
				});

				return defer;
			}
                let p = $('<div>').promise(); // eslint-disable-line
			setTimeout(function () {
                    p.done(); // eslint-disable-line
			}, 500);
                return p; // eslint-disable-line
		},

		/**
		 * Initialize the checkout stage.
		 *
		 * TODO: update this to allow stage to be set from server?
		 */
		initialize: function () {
			// set the initial state of checkout
			members.currentStage = checkoutStages
				.indexOf($('.data-checkout-stage').data('checkout-stage'));
			$(plugin).attr('data-checkout-stage', checkoutStages[members.currentStage]);

			//
			// Handle Payment option selection
			//
			$('input[name$="paymentMethod"]', plugin).on('change', function () {
				$('.credit-card-form').toggle($(this).val() === 'CREDIT_CARD');
			});

			//
			// Handle Next State button click
			//
			$(plugin).on('click', '.next-step-button button', function () {
				members.nextStage();
			});

			//
			// Handle Edit buttons on shipping and payment summary cards
			//
			$('.shipping-summary .edit-button', plugin).on('click', function () {
				if (!$('#checkout-main').hasClass('multi-ship')) {
					$('body').trigger('shipping:selectSingleShipping');
				}

				members.gotoStage('shipping');
			});

			$('.payment-summary .edit-button', plugin).on('click', function () {
				members.gotoStage('payment');
			});

			//
			// remember stage (e.g. shipping)
			//
			updateUrl(members.currentStage);

			//
			// Listen for foward/back button press and move to correct checkout-stage
			//
			$(window).on('popstate', function (e) {
				//
				// Back button when event state less than current state in ordered
				// checkoutStages array.
				//
				if (e.state === null ||
                        checkoutStages.indexOf(e.state) < members.currentStage) {
					members.handlePrevStage(false);
				} else if (checkoutStages.indexOf(e.state) > members.currentStage) {
					// Forward button  pressed
					members.handleNextStage(false);
				}
			});

			//
			// Payment method selection handling
			//

			// On load disable next button in payments
			$(window).on('load', function (e) {
				let stage = checkoutStages[members.currentStage];
				if (stage === 'payment') {
					$('body').trigger('checkout:disableButton', '.next-step-button button');
				}
			});

			// Payment method selected enables the button
			$('input[name=paymentOption]').on('change', function (e) {
				$('body').trigger('checkout:enableButton', '.next-step-button button');
			});

			//
			// Set the form data
			//
			plugin.data('formData', formData);
		},

		/**
		 * The next checkout state step updates the css for showing correct buttons etc...
		 */
		nextStage: function () {
			let promise = members.updateStage();

			promise.done(function () {
				// Update UI with new stage
				members.handleNextStage(true);
			});

			promise.fail(function (data) {
				// show errors
				if (data) {
					if (data.errorStage) {
						members.gotoStage(data.errorStage.stage);

						if (data.errorStage.step === 'billingAddress') {
							let $billingAddressSameAsShipping = $(
                                    'input[name$="_shippingAddressUseAsBillingAddress"]'
                                );
							if ($billingAddressSameAsShipping.is(':checked')) {
								$billingAddressSameAsShipping.prop('checked', false);
							}
						}
					}

					if (data.errorMessage) {
						$('.error-message').show();
						$('.error-message-text').text(data.errorMessage);
					}
				}
			});
		},

		/**
		 * The next checkout state step updates the css for showing correct buttons etc...
		 *
		 * @param {boolean} bPushState - boolean when true pushes state using the history api.
		 */
		handleNextStage: function (bPushState) {
			if (members.currentStage < checkoutStages.length - 1) {
				// move stage forward
				members.currentStage++;

				//
				// show new stage in url (e.g.payment)
				//
				if (bPushState) {
					updateUrl(members.currentStage);
				}
			}

			// Set the next stage on the DOM
			$(plugin).attr('data-checkout-stage', checkoutStages[members.currentStage]);
		},

		/**
		 * Previous State
		 */
		handlePrevStage: function () {
			if (members.currentStage > 0) {
				// move state back
				members.currentStage--;
				updateUrl(members.currentStage);
			}

			$(plugin).attr('data-checkout-stage', checkoutStages[members.currentStage]);
		},

		/**
		 * Use window history to go to a checkout stage
		 * @param {string} stageName - the checkout state to goto
		 */
		gotoStage: function (stageName) {
			members.currentStage = checkoutStages.indexOf(stageName);
			updateUrl(members.currentStage);
			$(plugin).attr('data-checkout-stage', checkoutStages[members.currentStage]);
		}
	};

	//
	// Initialize the checkout
	//
	members.initialize();

	return this;
};
}(jQuery));


baseCheckout.initialize = function () {
	$('#checkout-main').checkout();
};

baseCheckout.updateCheckoutView = function () {
	$('body').on('checkout:updateCheckoutView', function (e, data) {
		if (data.csrfToken) {
			$("input[name*='csrf_token']").val(data.csrfToken);
		}

		shippingHelpers.methods.updateMultiShipInformation(data.order);
		// summaryHelpers.updateTotals(data.order.totals);
		data.order.shipping.forEach(function (shipping) {
			shippingHelpers.methods.updateShippingInformation(
				shipping,
				data.order,
				data.customer,
				data.options
			);
		});

		let currentStage = window.location.search.substring(window.location.search.indexOf('=') + 1);
		if (currentStage === 'shipping' || currentStage === 'payment') {
			return;
		}

		billingHelpers.methods.updateBillingInformation(
			data.order,
			data.customer,
			data.options
		);
		billingHelpers.methods.updatePaymentInformation(data.order, data.options);
	});
};

module.exports = baseCheckout;
