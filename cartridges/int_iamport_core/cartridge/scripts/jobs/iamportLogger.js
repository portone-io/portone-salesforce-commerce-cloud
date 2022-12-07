'use strict';

var Logger = require('dw/system/Logger');

/**
 * iamportLogger class manages error and debug logging.
 *
 * @param {string} scriptFileName - name of the log file name
 */
function iamportLogger(scriptFileName) {
    this.scriptFileName = scriptFileName;
    this.log = Logger.getLogger('iamport', 'iamport');
}

/**
 * Logs error messages for a given script.
 * @param {string} errorMessage - text of error message
 */
iamportLogger.prototype.error = function (errorMessage) {
    if (Logger.isErrorEnabled()) {
        Logger.error(this.scriptFileName + ' ' + errorMessage);
    }
};

/**
 * Logs debug messages for a given script.
 * @param {string} debugMessage - text of debug message
 */
iamportLogger.prototype.debug = function (debugMessage) {
    if (this.log.isDebugEnabled()) {
        this.log.debug(this.scriptFileName + ' ' + debugMessage);
    }
};

/**
 * Logs info messages for a given script.
 * @param {string} infoMessage - text of info message
 */
iamportLogger.prototype.info = function (infoMessage) {
    if (this.log.isInfoEnabled()) {
        this.log.info(this.scriptFileName + ' ' + infoMessage);
    }
};

module.exports = iamportLogger;
