'use strict';

var customerHelpers = require('base/checkout/customer');
var addressHelpers = require('base/checkout/address');
var shippingHelpers = require('base/checkout/shipping');
var billingHelpers = require('./billing');
var summaryHelpers = require('base/checkout/summary');
var formHelpers = require('base/checkout/formErrors');
var scrollAnimate = require('base/components/scrollAnimate');
var iamportPayment = require('../iamport/paymentLoader');

/**
 * Create the jQuery Checkout Plugin. fgh
 *
 * This jQuery plugin will be registered on the dom element in checkout.isml with the
 * id of "checkout-main".
 *
 * The checkout plugin will handle the different state the user interface is in as the user
 * progresses through the varying forms such as shipping and payment.
 *
 * Billing info and payment info are used a bit synonymously in this code.
 */
(function ($) {
	$.fn.checkout = function () {
		let plugin = this;
		/**
         * Collect form data from user input
         */
		let formData = {
			// Customer Data
			customer: {},

			// Shipping Address
			shipping: {},

			// Billing Address
			billing: {},

			// Payment
			payment: {},

			// Gift Codes
			giftCode: {}
		};

		/**
         * The different states/stages of checkout
         */
		let checkoutStages = [
			'customer',
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
			history.pushState( // eslint-disable-line no-restricted-globals
				checkoutStages[currentStage],
				document.title,
				location.pathname // eslint-disable-line no-restricted-globals
                + '?stage='
                + checkoutStages[currentStage]
                + '#'
                + checkoutStages[currentStage]
			);
		}

		/**
         * Local member methods of the Checkout plugin
         */
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

				if (stage === 'customer') {
					// Clear Previous Errors
					customerHelpers.methods.clearErrors();
					// Submit the Customer Form
					let customerFormSelector = customerHelpers.methods.isGuestFormActive() ? customerHelpers.vars.GUEST_FORM : customerHelpers.vars.REGISTERED_FORM;
					let customerForm = $(customerFormSelector);
					$.ajax({
						url: customerForm.attr('action'),
						type: 'post',
						data: customerForm.serialize(),
						success: function (data) {
							if (data.redirectUrl) {
								window.location.href = data.redirectUrl;
							} else {
								customerHelpers.methods.customerFormResponse(defer, data);
							}
						},
						error: function (err) {
							if (err.responseJSON && err.responseJSON.redirectUrl) {
								window.location.href = err.responseJSON.redirectUrl;
							}
							// Server error submitting form
							defer.reject(err.responseJSON);
						}
					});
					return defer;
				} if (stage === 'shipping') {
					// Clear Previous Errors
					formHelpers.clearPreviousErrors('.shipping-form');

					// Submit the Shipping Address Form
					let isMultiShip = $('#checkout-main').hasClass('multi-ship');
					let formSelector = isMultiShip
						? '.multi-shipping .active form' : '.single-shipping .shipping-form';
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
									let errorHtml = '<div class="alert alert-danger alert-dismissible valid-cart-error '
                                        + 'fade show" role="alert">'
                                        + '<button type="button" class="close" data-dismiss="alert" aria-label="Close">'
                                        + '<span aria-hidden="true">&times;</span>'
                                        + '</button>' + errorMsg + '</div>';
									$('.shipping-error').append(errorHtml);
									$('.shipping-error').addClass('mt-4');
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
						// disable the next:Payment button here
						$('body').trigger('checkout:disableButton', '.next-step-button button');
						$.ajax({
							url: form.attr('action'),
							type: 'post',
							data: shippingFormData,
							success: function (data) {
								// Don't enable the next-step-button when moving to payment method
								// $('body').trigger('checkout:enableButton', '.next-step-button button');

								let hasPaymentMethodSelected = $('.payment-method:input:radio:checked').length > 0;
								if (hasPaymentMethodSelected) {
									$('body').trigger('checkout:enableButton', '.next-step-button button');
								}

								if (data.error && (data.fieldErrors.length || (data.serverErrors && data.serverErrors.length) || data.cartError)) {
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
				} if (stage === 'payment') {
					/**
                     * Submit the Billing Address Form
                     */

					formHelpers.clearPreviousErrors('.payment-form');

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
								let cvvCode = $('.saved-payment-instrument.'
                                    + 'selected-payment .saved-payment-security-code').val();

								if (cvvCode === '') {
									let cvvElement = $('.saved-payment-instrument.'
                                        + 'selected-payment '
                                        + '.form-control');
									cvvElement.addClass('is-invalid');
									scrollAnimate(cvvElement);
									defer.reject();
									return defer;
								}

								let $savedPaymentInstrument = $('.saved-payment-instrument'
                                    + '.selected-payment');

								paymentForm += '&storedPaymentUUID='
                                    + $savedPaymentInstrument.data('uuid');

								paymentForm += '&securityCode=' + cvvCode;
							}
						}
						// update selected credit card details in data for credit card payment method.
						if ($(':radio[name=paymentOption]').filter(':checked').attr('id') === 'card' && $('.saved-payment-instrument.selected-payment:visible').length > 0) {
							if ($('.saved-payment-instrument.selected-payment:visible').attr('data-uuid') !== '') {
								paymentForm += '&storedPaymentUUID='
								+ $('.saved-payment-instrument.selected-payment:visible').attr('data-uuid');
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
								//
								// Populate the Address Summary
								//
								$('body').trigger('checkout:updateCheckoutView',
									{ order: data.order, customer: data.customer });
								// populate the payment method in the payment summary
								iamportPayment.renderSelectedPaymentMethod(data.selectedPaymentMethod);
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
				} if (stage === 'placeOrder') {
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
							} else if (data.placedOrderWithSavedCard) {
								// redirect to order confirmation page after placed the order with saved credit card.
								var redirect = $('<form>')
								.appendTo(document.body)
								.attr({
									method: 'POST',
									action: data.continueUrl
								});

								$('<input>')
									.appendTo(redirect)
									.attr({
										name: 'orderID',
										value: data.orderID
									});

								$('<input>')
									.appendTo(redirect)
									.attr({
										name: 'orderToken',
										value: data.orderToken
									});

								redirect.submit();
								defer.resolve(data);
							} else {
								if (data.paymentResources) {
									let payload = {
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
							$('body').trigger('checkout:enableButton', '.next-step-button button');

							defer.reject();
						}
					});

					return defer;
				}

				if (stage === 'submitted') {
					$('body').trigger('checkout:enableButton', '.next-step-button button');
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

				$('body').on('click', '.submit-customer-login', function (e) {
					e.preventDefault();
					members.nextStage();
				});

				$('body').on('click', '.submit-customer', function (e) {
					e.preventDefault();
					members.nextStage();
				});

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
				$('.customer-summary .edit-button', plugin).on('click', function () {
					members.gotoStage('customer');
				});

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
				// Listen for forward/back button press and move to correct checkout-stage
				//
				$(window).on('popstate', function (e) {
					//
					// Back button when event state less than current state in ordered
					// checkoutStages array.
					//
					if (e.state === null
                        || checkoutStages.indexOf(e.state) < members.currentStage) {
						members.handlePrevStage(false);
					} else if (checkoutStages.indexOf(e.state) > members.currentStage) {
						// Forward button  pressed
						members.handleNextStage(false);
					}
				});


				// On load disable next button in payments
				$(window).on('load', function (e) {
					let stage = checkoutStages[members.currentStage];
					if (stage === 'payment') {
						$('body').trigger('checkout:disableButton', '.next-step-button button');
					}
				});

				// Payment method selected enables the button and hide/show the saved credit cards on selected payment methods
				$('input[name=paymentOption]').on('change', function (e) {
					$('body').trigger('checkout:enableButton', '.next-step-button button');
					if ($(this).attr('id') === 'card' && $('.iamport-cards').length > 0) {
						$('.user-payment-instruments').removeClass('checkout-hidden');
					} else {
						$('.user-payment-instruments').addClass('checkout-hidden');
					}
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
					$('.error-message').hide();
					$('.payments-error').hide();
					members.handleNextStage(true);
				});

				promise.fail(function (data) {
					if (data) {
						// Error creating the payment before paying and show error on Place Order

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

						if (data.action === 'CheckoutServices-PlaceOrder') {
							let errorMsg = data.errorMessage;
							if (data.errorMessage) {
								let paymentErrorHtml = '<div class="alert alert-danger alert-dismissible '
								+ 'fade show" role="alert">'
								+ '<button type="button" class="close" data-dismiss="alert" aria-label="Close">'
								+ '<span aria-hidden="true">&times;</span>'
								+ '</button>' + errorMsg + '</div>';

								$('.payments-error').append(paymentErrorHtml);
								$('.payments-error').show();
							}
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
					members.currentStage += 1;

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
					members.currentStage -= 1;
					updateUrl(members.currentStage);
				}

				$('body').trigger('checkout:enableButton', '.next-step-button button');

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

		/**
         * Initialize the checkout
         */
		members.initialize();

		return this;
	};
}(jQuery));


var exports = {
	initialize: function () {
		$('#checkout-main').checkout();
	},

	updateCheckoutView: function () {
		$('body').on('checkout:updateCheckoutView', function (e, data) {
			if (data.csrfToken) {
				$("input[name*='csrf_token']").val(data.csrfToken);
			}
			customerHelpers.methods.updateCustomerInformation(data.customer, data.order);
			shippingHelpers.methods.updateMultiShipInformation(data.order);
			summaryHelpers.updateTotals(data.order.totals);
			data.order.shipping.forEach(function (shipping) {
				shippingHelpers.methods.updateShippingInformation(
					shipping,
					data.order,
					data.customer,
					data.options
				);
			});
			billingHelpers.methods.updateBillingInformation(
				data.order,
				data.customer,
				data.options
			);
			billingHelpers.methods.updatePaymentInformation(data.order, data.options);
			summaryHelpers.updateOrderProductSummaryInformation(data.order, data.options);
		});
	},

	disableButton: function () {
		$('body').on('checkout:disableButton', function (e, button) {
			$(button).prop('disabled', true);
		});
	},

	enableButton: function () {
		$('body').on('checkout:enableButton', function (e, button) {
			$(button).prop('disabled', false);
		});
	}
};

[customerHelpers, billingHelpers, shippingHelpers, addressHelpers].forEach(function (library) {
	Object.keys(library).forEach(function (item) {
		if (typeof library[item] === 'object') {
			exports[item] = $.extend({}, exports[item], library[item]);
		} else {
			exports[item] = library[item];
		}
	});
});

module.exports = exports;
