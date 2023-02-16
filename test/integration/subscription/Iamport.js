var assert = require('chai').assert;
var request = require('request-promise');
var config = require('../general.config');

function updateCookies(cookieJar, requestObj) {
    var cookieString = cookieJar.getCookieString(requestObj.url);
    var cookie = request.cookie(cookieString);
    cookieJar.setCookie(cookie, requestObj.url);
}

describe('Controller Iamport', () => {
	describe('Iamport-RequestBillingKey', function () {
        this.timeout(5000);

		it('should forbid non-registered users to save payment instruments', function () {
            var myRequest = {
                url: config.baseUrl + '/Iamport-RequestBillingKey',
                method: 'POST',
                rejectUnauthorized: false,
                resolveWithFullResponse: true,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
				form : {
					customer_uid : '677752733_00001001'
				}
            };
            return request(myRequest)
				.then(function (success) {
					console.log(success);
					assert.fail(`Not registered user should not receive ${success.statusCode} status code`);
				}).catch(function (reject) {
					assert.equal(reject.statusCode, 500);
				});
        });
    });

    describe('Iamport-SaveBillingKey', function () {
        this.timeout(5000);

		it('should forbid non-registered users to save payment instruments', function () {
            var myRequest = {
                url: config.baseUrl + '/Iamport-SaveBillingKey',
                method: 'POST',
                rejectUnauthorized: false,
                resolveWithFullResponse: true,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
				form : {
					customer_uid : '677752733_00001001'
				}
            };
            return request(myRequest)
				.then(function (success) {
					console.log(success);
					assert.fail(`Not registered user should not receive ${success.statusCode} status code`);
				}).catch(function (reject) {
					assert.equal(reject.statusCode, 500);
				});
        });
    });
});
