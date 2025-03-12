/**
 *
 * @interface
 */
function TransportInterface() {
    this.send = function () {
        throw new Error('Not implemented');
    }
}

module.exports = TransportInterface;
