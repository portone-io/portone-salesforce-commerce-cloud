'use strict';

const OrderMgr = require('dw/order/OrderMgr');
const Calendar = require('dw/util/Calendar');
const Transaction = require('dw/system/Transaction');
const Site = require('dw/system/Site');
const Order = require('dw/order/Order');
const Status = require('dw/system/Status');
const Resource = require('dw/web/Resource');
const iamportLogger = require('dw/system/Logger').getLogger('iamport', 'Iamport');
var count = 0;

/**
 * Fail the unpaid orders if it has exceed the given time.
 * @param {Object} order - the order model
 * @returns {dw.system.Status} Status : dw.system.Status
 */
function callback(order) {
    try {
        if ('vbankExpiration' in order.custom && order.custom.vbankExpiration) {
            let siteTimeZone = Site.getCurrent().timezone;
            let subject = Resource.msg('order.note.job.subject', 'import', null);
            let reason = Resource.msg('order.note.job.fail.order', 'import', null);
            // current time
            let nowCal = new Calendar(new Date());
            nowCal.setTimeZone(siteTimeZone);

            let expirationCal = new Calendar(new Date(order.custom.vbankExpiration));
            expirationCal.setTimeZone(siteTimeZone);

            if (nowCal.compareTo(expirationCal) > 0) {
                count++;
                Transaction.wrap(function () {
                    OrderMgr.failOrder(order, false);
                    order.addNote(subject, reason);
                });
                iamportLogger.info('Fail Unpaid VirtualPayment Order ' + order.orderNo);
            }
        }
        return new Status(Status.OK);
    } catch (e) {
        iamportLogger.error('Error during processing order ' + order.orderNo + ' - ' + e.stack);
        return new Status(Status.ERROR, 'ERROR', e.stack);
    }
}

/**
* Fetch virtual payment orders.
*/
function processOrders() {
    let queryStr = 'custom.isVirtualPayment = {0} AND status = {1}';
    OrderMgr.processOrders(callback, queryStr, true, Order.ORDER_STATUS_CREATED);
    iamportLogger.info('found ' + count + '  orders');
}

module.exports.execute = processOrders;

