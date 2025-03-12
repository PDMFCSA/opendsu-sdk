function LegacyDSUFactory(factoryOptions) {
    const LegacyDSU = require("../../dsu/LegacyDSU");
    const BarFactory = require("./BarFactory");
    const barFactoryInstance = new BarFactory(factoryOptions);
    const DSUInstancesRegistry = require("../../utils/RaceConditionPreventer");
    const dsuInstancesRegistry = new DSUInstancesRegistry();

    const storeDSUInstance = (legacyDSU) => {
        dsuInstancesRegistry.put(legacyDSU.getAnchorIdSync(), legacyDSU);
    }

    this.create = (keySSI, options, callback) => {
        barFactoryInstance.create(keySSI, options, (err, barInstance) => {
            if (err) {
                return callback(err);
            }

            const legacyDSU = new LegacyDSU(barInstance, dsuInstancesRegistry);
            storeDSUInstance(legacyDSU);
            callback(undefined, legacyDSU);
        })
    }

    this.load = (keySSI, options, callback) => {
        barFactoryInstance.load(keySSI, options, (err, barInstance) => {
            if (err) {
                return callback(err);
            }

            const legacyDSU = new LegacyDSU(barInstance, dsuInstancesRegistry);
            storeDSUInstance(legacyDSU);
            callback(undefined, legacyDSU);
        })
    }
}

module.exports = LegacyDSUFactory;
