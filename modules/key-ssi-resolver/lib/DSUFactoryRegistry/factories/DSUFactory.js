const dsuTypesFactoryRegistry = {}
const DSUTypes = require("../DSUTypes");

function DSUFactory(factoryOptions) {
    const dsuFactoryInstancesRegistry = {};
    for (let dsuType in dsuTypesFactoryRegistry) {
        dsuFactoryInstancesRegistry[dsuType] = dsuTypesFactoryRegistry[dsuType](factoryOptions);
    }

    this.create = (keySSI, options, callback) => {
        const defaultInstanceOptions = {dsuType: DSUTypes.LEGACY_DSU};
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        Object.assign(defaultInstanceOptions, options);
        options = defaultInstanceOptions;
        if (typeof dsuTypesFactoryRegistry[options.dsuType] !== "function") {
            return callback(Error(`No factory registered for dsu type <${options.dsuType}>`));
        }

        const factoryInstance = dsuFactoryInstancesRegistry[options.dsuType];
        factoryInstance.create(keySSI, options, callback);
    }

    this.load = (keySSI, options, callback) => {
        const defaultInstanceOptions = {dsuType: DSUTypes.LEGACY_DSU};
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        Object.assign(defaultInstanceOptions, options);
        options = defaultInstanceOptions;
        if (typeof dsuTypesFactoryRegistry[options.dsuType] !== "function") {
            return callback(Error(`No factory registered for dsu type <${options.dsuType}>`));
        }

        const factoryInstance = dsuFactoryInstancesRegistry[options.dsuType];
        factoryInstance.load(keySSI, options, callback);
    }
}

DSUFactory.prototype.registerDSUTypeFactory = (dsuType, factory) => {
    dsuTypesFactoryRegistry[dsuType] = factory;
}

const LegacyDSUFactory = require("./LegacyDSUFactory");
const BarFactory = require("./BarFactory");

DSUFactory.prototype.registerDSUTypeFactory(DSUTypes.LEGACY_DSU, function (factoryOptions) {
    return new LegacyDSUFactory(factoryOptions);
});
DSUFactory.prototype.registerDSUTypeFactory(DSUTypes.BAR, function (factoryOptions) {
    return new BarFactory(factoryOptions);
});

module.exports = DSUFactory;
