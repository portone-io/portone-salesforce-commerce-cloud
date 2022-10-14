'use strict';

/**
 * re-renders the order totals and the number of items in the cart
 * @param {Object} message - Error message to display
 */
function createErrorNotification(message) {
	let errorHtml = '<div class="alert alert-danger alert-dismissible valid-payment-error ' +
        'fade show" role="alert">' +
        '<button type="button" class="close" data-dismiss="alert" aria-label="Close">' +
        '<span aria-hidden="true">&times;</span>' +
        '</button>' + message + '</div>';

	$('.payment-error').append(errorHtml);
}

module.exports = {
	createErrorNotification: createErrorNotification
};
