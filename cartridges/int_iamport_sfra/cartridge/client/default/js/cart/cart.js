'use strict';

module.exports = {
	cleanBrowserUrlAfterIamportError: function () {
		$('body').on('click', '.cart-error button.close span', function () {
			let currentBrowserUrl = new URL(window.location.href);

			if (currentBrowserUrl.searchParams.get('err')) {
				currentBrowserUrl.searchParams.delete('err');
			}

			window.history.pushState({}, null, currentBrowserUrl.toString());
		});
	}
};
