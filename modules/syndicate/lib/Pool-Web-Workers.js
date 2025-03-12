const AbstractPool = require('./AbstractPool');
const util = require('util');

/**
 * @param {PoolConfig&PoolConfigStorage} options
 * @param {function} workerCreateHelper
 * @mixes AbstractPool
 */
function PoolWebWorkers(options, workerCreateHelper) {
    AbstractPool.call(this, options);

    this.createNewWorker = function (callback) {

        const envTypes = require("overwrite-require").constants;
        if ($$.environmentType !== envTypes.BROWSER_ENVIRONMENT_TYPE) {
            return callback(new Error(`Web Worker is not available into current environment type <${$$.environmentType}>`));
        }

        const newWorker = new Worker(options.bootScript, options.workerOptions);

        if (typeof workerCreateHelper === "function") {
            workerCreateHelper(newWorker);
        }

        const callbackWrapper = (...args) => {
            removeListeners();
            callback(...args);
        };

        function onMessage(msg) {
            if (msg.data !== 'ready') {
                callbackWrapper(new Error('Build script did not respond accordingly, it might be incompatible with current version'));
                return;
            }

            callbackWrapper(undefined, newWorker);
        }

        function removeListeners() {
            newWorker.removeEventListener('message', onMessage);
            newWorker.removeEventListener('messageerror', callbackWrapper);
        }

        newWorker.addEventListener('message', onMessage);
        newWorker.addEventListener('messageerror', callbackWrapper);
    };

}

util.inherits(PoolWebWorkers, AbstractPool);

module.exports = PoolWebWorkers;
