'use strict';


/**
 * @param {string} el pass the elements
 */
function unbindEvents(el) {
	el.off('close.bs.alert');
	$(document).off('keyup.notification');
}

/**
 * @param {string} el pass the elements
 */
function bindEvents(el) {
	el.on('close.bs.alert', function () {
		unbindEvents(el);
	});

	$(document).on('keyup.notification', function (e) {
		var isEscape = ('key' in e) ? (e.key === 'Escape' || e.key === 'Esc') : e.keyCode === 27;

		if (isEscape) {
			el.alert('close');
		}
	});
}

/**
 * Creates a notification on the page. More info please see: https://getbootstrap.com/docs/4.0/components/alerts/
 *
 * @param {Object} [options] - Options for notification
 * @param {string} [option.target=body] - Target where the notification will be appended to. Default: $('body')
 * @param {string} [option.message=data-notification] - The text shown inside notification. Default: $(target).data('notification')
 * @param {string} [options.classes] - Additional classes to be added in the element
 * @param {string} [options.color=alert-danger] - The contextual class to set the background color. Default: alert-danger
 * @param {boolean} [options.dismissible] - Enable close button to dismiss the notification
 * @param {number} [options.dismissTime] - Define a time (ms) to dismiss the notification
 * @param {Function} [options.callback] - A callback function
 */
function createNotification(options) {
	var { classes, color, dismissible, dismissTime, message, target, callback } = options || {};
	var $target = target ? $(target) : $('body');
	var $el = $(`<div class='alert fade show ${color || 'alert-danger'} ${dismissible ? 'alert-dismissible' : ''} ${classes || ''}' role='alert'>`).html(`
		<button type='button' class='close ${!dismissible ? 'd-none' : ''}' data-dismiss='alert' aria-label='Close'>
			<i class='material-icons'>close</i>
		</button>
		${message || $target.data('notification')}
	`);

	$target.append($el);
	bindEvents($el);

	if (dismissTime && dismissTime > 0) {
		setTimeout(function () {
			$el.alert('close');

			if (callback) {
				callback();
			}
		}, dismissTime);
	} else if (callback) {
		callback();
	}
}

module.exports = createNotification;

