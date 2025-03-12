const KeySSIResolver = require('./lib/KeySSIResolver');
const DSUFactory = require("./lib/DSUFactoryRegistry");

/**
 * Create a new KeySSIResolver instance and append it to
 * global object $$
 *
 * @param {object} options
 */
function initialize(options) {
    options = options || {};


    const BrickMapStrategyFactory = require("bar").BrickMapStrategyFactory;

    const brickMapStrategyFactory = new BrickMapStrategyFactory();
    const keySSIFactory = require('./lib/KeySSIs/KeySSIFactory');

    options.dsuFactory = new DSUFactory({
        brickMapStrategyFactory,
        keySSIFactory
    });

    const keySSIResolver = new KeySSIResolver(options);

    return keySSIResolver;
}

module.exports = {
    initialize,
    KeySSIFactory: require('./lib/KeySSIs/KeySSIFactory'),
    CryptoAlgorithmsRegistry: require('./lib/CryptoAlgorithms/CryptoAlgorithmsRegistry'),
    CryptoFunctionTypes: require('./lib/CryptoAlgorithms/CryptoFunctionTypes'),
    SSITypes: require("./lib/KeySSIs/SSITypes"),
    SSIFamilies: require("./lib/KeySSIs/SSIFamilies"),
    DSUTypes: require("./lib/DSUFactoryRegistry/DSUTypes"),
    DSUFactory: require("./lib/DSUFactoryRegistry"),
    KeySSIMixin: require('./lib/KeySSIs/KeySSIMixin'),
    CryptoAlgorithmsMixin: require('./lib/CryptoAlgorithms/CryptoAlgorithmsMixin')
};
