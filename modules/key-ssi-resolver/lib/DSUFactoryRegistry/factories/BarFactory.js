/**
 * @param {object} options
 * @param {KeySSIFactory} options.keySSIFactory
 * @param {BrickMapStrategyFactory} options.brickMapStrategyFactory
 */
const cache = require('psk-cache').getDefaultInstance();

function BarFactory(factoryOptions) {
    const barModule = require('bar');
    const fsAdapter = require('bar-fs-adapter');
    factoryOptions = factoryOptions || {};
    const MAX_BRICK_SIZE = factoryOptions.maxBrickSize || 10000000;
    this.keySSIFactory = factoryOptions.keySSIFactory;
    this.brickMapStrategyFactory = factoryOptions.brickMapStrategyFactory || new barModule.BrickMapStrategyFactory();
    const openDSU = require("opendsu");
    const keySSISpace = openDSU.loadAPI("keyssi");
    const INSTANCE_CREATION_METHODS = {
        INIT: "init", LOAD: "load", LOAD_VERSION: "loadVersion"
    }

    function castSSI(ssi) {
        if (typeof ssi !== "undefined") {
            if (typeof ssi === "string") {
                ssi = keySSISpace.parse(ssi);
            } else {
                if (ssi.getTypeName === undefined || ssi.getIdentifier === undefined) {
                    throw Error("Please provide a proper SSI instance ");
                }
            }
        } else {
            throw Error("SSI should not be undefined");
        }
        return ssi;
    }

    ////////////////////////////////////////////////////////////
    // Private methods
    ////////////////////////////////////////////////////////////

    /**
     * @param {SeedSSI} keySSI
     * @param {object} options
     * @param {string} initializationMethod
     * @param {function} callback
     * @return {Archive}
     */
    const createInstance = (keySSI, options, initializationMethod, callback) => {
        const allowedInitMethods = Object.values(INSTANCE_CREATION_METHODS);
        if (!options) {
            options = {};
        }
        if (typeof options.useMineMergeStrategy === "undefined") {
            options.useMineMergeStrategy = false;
        }

        if (allowedInitMethods.indexOf(initializationMethod) === -1) {
            throw Error("Wrong usage of the createInstance method");
        }

        let bar;
        try {
            const ArchiveConfigurator = barModule.ArchiveConfigurator;
            ArchiveConfigurator.prototype.registerFsAdapter("FsAdapter", fsAdapter.createFsAdapter);
            const archiveConfigurator = new ArchiveConfigurator(options);
            archiveConfigurator.setCache(cache);
            const envTypes = require("overwrite-require").constants;
            if ($$.environmentType !== envTypes.BROWSER_ENVIRONMENT_TYPE && $$.environmentType !== envTypes.SERVICE_WORKER_ENVIRONMENT_TYPE && $$.environmentType !== envTypes.WEB_WORKER_ENVIRONMENT_TYPE) {
                archiveConfigurator.setFsAdapter("FsAdapter");
            }
            archiveConfigurator.setBufferSize(MAX_BRICK_SIZE);
            archiveConfigurator.setKeySSI(keySSI);
            let brickMapStrategyName = options.brickMapStrategy;
            let anchoringOptions = options.anchoringOptions;

            let brickMapStrategy = createBrickMapStrategy(brickMapStrategyName, anchoringOptions);
            archiveConfigurator.setBrickMapStrategy(brickMapStrategy);

            if (options.validationRules) {
                archiveConfigurator.setValidationRules(options.validationRules);
            }

            if (options.skipCache) {
                archiveConfigurator.disableDSUCaching()
            }

            bar = barModule.createArchive(archiveConfigurator);
            const DSUBase = require("../mixins/DSUBase");
            DSUBase(bar);
        } catch (err) {
            return callback(err);
        }

        let defaultCallback = err => {
            callback(err, bar)
        };

        let initCallback = (err) => {
            if (err) {
                return callback(err);
            }

            if (typeof options === "object" && options.addLog) {
                return bar.dsuLog("DSU created on " + Date.now(), defaultCallback);
            }

            callback(err, bar);
        }

        if (initializationMethod === INSTANCE_CREATION_METHODS.LOAD) {
            if (options.versionHashlink) {
                initializationMethod = INSTANCE_CREATION_METHODS.LOAD_VERSION;
                return bar[initializationMethod](options.versionHashlink, defaultCallback);
            }
        }

        bar[initializationMethod](initializationMethod === INSTANCE_CREATION_METHODS.INIT ? initCallback : defaultCallback);
    }

    /**
     * @return {object}
     */
    const createBrickMapStrategy = (name, options) => {
        return this.brickMapStrategyFactory.create(name, options);
    }

    /**
     * @param templateKeySSI
     * @param callback
     */
    const initializeKeySSI = (templateKeySSI, callback) => {
        if (typeof templateKeySSI === "function") {
            callback = templateKeySSI;
            templateKeySSI = undefined;
        }

        if (!templateKeySSI) {
            return callback(Error("A template keySSI should be provided when creating a new DSU."));
        }

        keySSISpace.createSeedSSI(templateKeySSI.getDLDomain(), undefined, templateKeySSI.getHint(), callback);
    }

    ////////////////////////////////////////////////////////////
    // Public methods
    ////////////////////////////////////////////////////////////

    /**
     * @param {string} keySSI
     * @param {object} options
     * @param {string} options.brickMapStrategy 'Diff', 'Versioned' or any strategy registered with the factory
     * @param {object} options.anchoringOptions Anchoring options to pass to bar map strategy
     * @param {callback} options.anchoringOptions.decisionFn Callback which will decide when to effectively anchor changes
     *                                                              If empty, the changes will be anchored after each operation
     * @param {callback} options.anchoringOptions.conflictResolutionFn Callback which will handle anchoring conflicts
     *                                                              The default strategy is to reload the BrickMap and then apply the new changes
     * @param {callback} options.anchoringOptions.anchoringEventListener An event listener which is called when the strategy anchors the changes
     * @param {callback} options.anchoringOptions.signingFn  A function which will sign the new alias
     * @param {object} options.validationRules
     * @param {object} options.validationRules.preWrite An object capable of validating operations done in the "preWrite" stage of the BrickMap
     * @param {callback} callback
     */
    this.create = (keySSI, options, callback) => {
        keySSI = castSSI(keySSI);
        if (typeof options === "function") {
            callback = options;
            options = undefined;
        }
        options = options || {};
        if (options.useSSIAsIdentifier) {
            return createInstance(keySSI, options, INSTANCE_CREATION_METHODS.INIT, callback);
        }

        initializeKeySSI(keySSI, (err, _keySSI) => {
            if (err) {
                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to initialize keySSI <${keySSI.getIdentifier(true)}>`, err));
            }
            return createInstance(_keySSI, options, INSTANCE_CREATION_METHODS.INIT, callback);
        });
    }

    /**
     * @param {string} keySSI
     * @param {object} options
     * @param {string} options.brickMapStrategy 'Diff', 'Versioned' or any strategy registered with the factory
     * @param {object} options.anchoringOptions Anchoring options to pass to bar map strategy
     * @param {callback} options.anchoringOptions.decisionFn Callback which will decide when to effectively anchor changes
     *                                                              If empty, the changes will be anchored after each operation
     * @param {callback} options.anchoringOptions.conflictResolutionFn Callback which will handle anchoring conflicts
     *                                                              The default strategy is to reload the BrickMap and then apply the new changes
     * @param {callback} options.anchoringOptions.anchoringEventListener An event listener which is called when the strategy anchors the changes
     * @param {callback} options.anchoringOptions.signingFn  A function which will sign the new alias
     * @param {object} options.validationRules
     * @param {object} options.validationRules.preWrite An object capable of validating operations done in the "preWrite" stage of the BrickMap
     * @param {callback} callback
     */
    this.load = (keySSI, options, callback) => {
        keySSI = castSSI(keySSI);
        if (typeof options === "function") {
            callback = options;
            options = undefined;
        }
        options = options || {};
        createInstance(keySSI, options, INSTANCE_CREATION_METHODS.LOAD, callback);
    }
}

module.exports = BarFactory;
