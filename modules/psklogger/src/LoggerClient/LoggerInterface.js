/**
 * @interface
 */
function LoggerInterface() {
    function genericMethod() {
        throw new Error('Not implemented');
    }

    this.debug = genericMethod;
    this.error = genericMethod;
    this.event = genericMethod;
    this.info = genericMethod;
    this.log = genericMethod;
    this.redirect = genericMethod;
    this.warn = genericMethod;
}

module.exports = LoggerInterface;
