'use strict';

// Available methods

// Give error string
function error(text) {
    return text;
}
function info(text) {
    return text;
}
function debug(text) {
    return text;
}
// dw.system.Logger methods
function getLogger() {
    return {
        error: error,
        info: info,
        debug: debug
    };
}

module.exports = {
    getLogger: getLogger,
    error: error,
    info: info,
    debug: debug
};