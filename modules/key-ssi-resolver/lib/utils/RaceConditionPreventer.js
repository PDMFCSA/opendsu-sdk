const BarFactory = require("../DSUFactoryRegistry/factories/BarFactory");
const barFactoryInstance = new BarFactory();

function RaceConditionPreventer() {
    let opendsu = require("opendsu");
    let keySSI = opendsu.loadApi("keyssi");
    const TaskCounter = require("swarmutils").TaskCounter;

    const instancesRegistry = {};
    const self = this;

    $$.weakDSUCache = {
        get: async (key) => {
            if (typeof key === "string") {
                key = keySSI.parse(key);
            }
            key = await key.getAnchorIdAsync(true);
            let instances = getDerefedInstances(key);
            if (instances.length) {
                return instances[0];
            }

        }
    };

    self.put = (key, instance) => {
        if (!instancesRegistry[key]) {
            instancesRegistry[key] = new Set();
        }
        instance = instance ? new WeakRef(instance) : instance;
        instancesRegistry[key].add(instance);
    }

    self.set = self.put;
    self.loadNewBarInstance = (bar, callback) => {
        bar.getKeySSIAsObject((err, keySSI) => {
            if (err) {
                return callback(err);
            }
            barFactoryInstance.load(keySSI, (err, _barInstance) => {
                if (err) {
                    return callback(err);
                }

                bar = _barInstance;
                callback(undefined, _barInstance);
            });
        })
    };

    const getDerefedInstances = (key) => {
        const instances = [];
        const weakRefs = instancesRegistry[key];
        if (!weakRefs) {
            return instances;
        }
        for (let weakRef of weakRefs) {
            let inst = weakRef.deref();
            if (inst) {
                instances.push(inst);
            }
        }

        return instances;
    }

    self.getAllInstances = () => {
        const instances = [];
        const keys = Object.keys(instancesRegistry);
        for (let key of keys) {
            instances.push(...getDerefedInstances(key));
        }
        return instances;
    }

    self.beginBatch = (key, _instance) => {
        for (let instance of getDerefedInstances(key)) {
            if (instance && instance === _instance) {
                instance.beginBatch();
                return;
            }
        }
    }

    self.batchInProgress = (key) => {
        const instances = getDerefedInstances(key);
        for (let instance of instances) {
            if (instance && instance.batchInProgress()) {
                return true;
            }
        }
        return false;
    }

    self.notifyBatchCommitted = (key, callback) => {
        const instances = getDerefedInstances(key);
        if (!instances.length) {
            return callback();
        }
        const taskCounter = new TaskCounter(() => {
            callback();
        });

        taskCounter.increment(instances.length);
        instances.forEach((instance) => {
            if (!instance) {
                taskCounter.decrement();
                return;
            }
            instance.refresh((err) => {
                if (err) {
                    return callback(err);
                }
                taskCounter.decrement();
            });
        })
    }

    let continuations = {};
    //this api is meant only for beginBatch family of function, and it should not be used for anything else!
    self.waitUntilCanBeginBatch = (anchorId, continuation, instance) => {
        if (!continuations[anchorId]) {
            continuations[anchorId] = [];
        }
        continuations[anchorId].push({continuation, instance});
    }

    let locks = {};

    self.lockAnchorId = (anchorId, instance) => {
        if (locks[anchorId]) {
            throw new Error(`AnchorId ${anchorId} already locked`);
        }
        locks[anchorId] = instance.getInstanceUID();
        return true;
    }

    self.unlockAnchorId = (anchorId) => {
        let executeAllContinuations = (myInstance) => {
            let isVirtual = false;
            for (let i = possibleContinuations.length - 1; i >= 0; i--) {
                let {continuation, instance} = possibleContinuations[i];
                if (instance === myInstance) {
                    if (typeof continuation !== "function") {
                        console.error(Error(`Failed to execution continuation because is not a function: ${continuation ? continuation.toString() : continuation}`));
                    }
                    try {
                        continuation(isVirtual);
                        isVirtual = true;
                    } catch (err) {
                        console.error(Error("Continuation functions should not throw exceptions. Ignoring code, possible invalid state."));
                    }
                    possibleContinuations.splice(i, 1);
                }
            }
        }
        if (!locks[anchorId]) {
            throw new Error(`AnchorId ${anchorId} wasn't locked`);
        }
        locks[anchorId] = undefined;
        delete locks[anchorId];

        let possibleContinuations = continuations[anchorId];
        if (possibleContinuations && possibleContinuations.length > 0) {
            let {instance} = possibleContinuations[0];
            executeAllContinuations(instance);
        }
        return true;
    }

    self.isLocked = (anchorId) => {
        return !!locks[anchorId];
    }

    self.notifyBatchCancelled = self.notifyBatchCommitted;

    if ($$.environmentType === "browser" && window.top.location === window.location) {
        return;
    }

    /*  DEBUG Stuff */
    let sharedEnclaveId;
    let mainEnclaveId;
    let mainAnchorId;

    setTimeout(async () => {
        try {
            let envData = await $$.promisify(opendsu.loadApi("config").readEnvFile)();
            sharedEnclaveId = envData["sharedEnclaveKeySSI"];
            if (sharedEnclaveId) {
                sharedEnclaveId = await keySSI.parse(sharedEnclaveId).getAnchorIdAsync(true)
            }

            mainEnclaveId = envData["enclaveKeySSI"];
            if (mainEnclaveId) {
                mainEnclaveId = await keySSI.parse(mainEnclaveId).getAnchorIdAsync(true);
            }

            let mainDSU = await $$.promisify(opendsu.loadApi("sc").getMainDSU)();
            if (mainDSU) {
                mainAnchorId = mainDSU.getAnchorIdSync(true);
            }
        } catch (err) {
            //issues with maindsu, could happen in some environments
        }
    }, 1000);

    function dumpBatchInfo() {
        let anchorIds = Object.keys(instancesRegistry);

        for (let anchorId of anchorIds) {
            let instances = instancesRegistry[anchorId];
            let noInstances = 0;
            let instancesInBatchMode = [];
            let allInstances = [];

            let guessType = () => {
                /*const contentMaxLength = 100;
                let dsuContent = await $$.promisify(instance.listFiles, instance)("/");
                dsuContent = dsuContent.toString();
                if(dsuContent.length >= contentMaxLength){
                    dsuContent = dsuContent.slice(0, contentMaxLength-3) + "...";
                }
                //console.log(dsuContent);
                if(dsuContent.indexOf("publicKeys") !== -1){
                    return "DID_DSU";
                } */
                return "DATA_DSU"
            }

            let type;
            switch (anchorId) {
                case mainAnchorId:
                    type = "MAIN_DSU";
                    break;
                case sharedEnclaveId:
                    type = "SHRD_ENC";
                    break;
                case mainEnclaveId:
                    type = "MAIN_ENC";
                    break;
                default:
                    type = "UNKN_DSU";
            }

            for (let instance of instances) {
                instance = instance.deref();
                if (instance) {
                    noInstances++;
                    allInstances.push(instance.getInstanceUID());
                    if (type === "UNKN_DSU") {
                        type = guessType();
                    }
                    if (instance.batchInProgress()) {
                        instancesInBatchMode.push(instance.getInstanceUID());
                    }
                }
            }

            let anchor = keySSI.parse(anchorId);
            if (!noInstances) {
                continue;
            }

            anchor = anchor.getIdentifier(true);
            anchor = anchor.substring(4, 27) + "...";

            console.log(`\tDSU [${anchor}] [${type}]:  In batch mode [${instancesInBatchMode}] All instances: [${allInstances}]`);
        }
    }

    function dumpLocks() {
        console.log(`\tCurrent locks ${JSON.stringify(locks)}`);
    }

    function dumpContinuations() {
        console.log(`\tContinuations on ${JSON.stringify(Object.keys(continuations))}`);
    }

    if ($$ && $$.debug) {
        console.log(">>> $$.debug.status() available");
        $$.debug.status = () => {
            console.log("Registry status===============================");
            dumpLocks();
            dumpContinuations();
            dumpBatchInfo();
            console.log("=============================================");
        }
    }
    /* END DEBUG Stuff */
}

module.exports = RaceConditionPreventer;