'use strict';

const OrderMgr = require('dw/order/OrderMgr');
const Calendar = require('dw/util/Calendar');
const Transaction = require('dw/system/Transaction');
const Site = require('dw/system/Site');
const Order = require('dw/order/Order');
var VirtualOrderLogger = require('./iamportLogger');
var log = new VirtualOrderLogger('virtualOrderCancelled.js');
var count = 0;
var orders = [];

/**
 *
 * @param {Object} order
 * @returns Status
 */
function callback(order) {
    try {
        count++;
        orders.push(order.orderNo);
        log.debug('Order cancel Request for Order ' + order.orderNo);
    return new Status(Status.OK, 'OK', 'Orders has been successfully Updated');
    } catch (e) {
        log.error('Error during processing order ' + order.orderNo + ' - ' + e.toString());
    return new Status(Status.ERROR, 'ERROR', e.toString());
    }
}

/**
* Call virtual order status update functionality.
*/
function processOrders() {
    var queryStr = 'custom.isVirtualPayment = {0} AND status = {1}';
    OrderMgr.processOrders(callback, queryStr, true, Order.ORDER_STATUS_CREATED);
    log.info('found ' + count + '  orders');
}



module.exports.execute = processOrders;
