const {getLokiEnclaveFacade} = require("./utils");
const constants = require("./constants");

function LokiDBPathStrategy(storageFolder, config) {
    const defaultConfig = {
        maxNoScatteredKeys: 5000
    }
    Object.assign(defaultConfig, config);
    config = defaultConfig;
    const openDSU = require("opendsu");
    const utilsAPI = openDSU.loadAPI("utils");
    const keySSISpace = openDSU.loadAPI("keyssi");
    utilsAPI.ObservableMixin(this);
    let enclaveDSU;
    let initialised = false;
    const init = async () => {
        try {
            enclaveDSU = getLokiEnclaveFacade(storageFolder);
        } catch (e) {
            throw createOpenDSUErrorWrapper(`Failed to load enclave DSU`, e);
        }

        this.finishInitialisation();
    }

    this.isInitialised = () => {
        return initialised;
    };

    this.storePathKeySSI = (pathKeySSI, callback) => {
        if (typeof pathKeySSI === "string") {
            try {
                pathKeySSI = keySSISpace.parse(pathKeySSI);
            } catch (e) {
                return callback(e);
            }
        }
        const __storePathKeySSI = () => {
            const table = constants.TABLE_NAMES.SCATTERED_PATH_KEYS;
            enclaveDSU.insertRecord("", table, pathKeySSI.getIdentifier(), {
                identifier: pathKeySSI.getIdentifier(),
                specificString: pathKeySSI.getSpecificString()
            }, async (err) => {
                if (err) {
                    return callback(err);
                }
                try {
                    const recordsNumber = await $$.promisify(enclaveDSU.count)(table);
                    const records = await $$.promisify(enclaveDSU.getAllRecords)("", table);
                    if (recordsNumber === config.maxNoScatteredKeys) {
                        //to do 
                    }
                    callback();
                } catch (e) {
                    callback(e);
                }
            })
        };

        __storePathKeySSI();
    };

    // const compactPathKeys = async () => {
    //     let compactedContent = "";
    //     const crypto = require("opendsu").loadAPI("crypto");
    //     const files = await $$.promisify(enclaveDSU.listFiles)(constants.PATHS.SCATTERED_PATH_KEYS);

    //     for (let i = 0; i < files.length; i++) {
    //         const { key, value } = getKeyValueFromPath(files[i]);
    //         compactedContent = `${compactedContent}${key} ${value}\n`;
    //     }

    //     compactedContent = compactedContent.slice(0, compactedContent.length - 1);
    //     const fileName = crypto.encodeBase58(crypto.generateRandom(16));
    //     await $$.promisify(enclaveDSU.writeFile)(pathModule.join(constants.PATHS.COMPACTED_PATH_KEYS, fileName), compactedContent);

    //     for (let i = 0; i < files.length; i++) {
    //         const filePath = pathModule.join(constants.PATHS.SCATTERED_PATH_KEYS, files[i]);
    //         await $$.promisify(enclaveDSU.delete)(filePath);
    //     }
    // }

    // const getKeyValueFromPath = (pth) => {
    //     const lastSegmentIndex = pth.lastIndexOf("/");
    //     const key = pth.slice(0, lastSegmentIndex);
    //     const value = pth.slice(lastSegmentIndex + 1);
    //     return {
    //         key, value
    //     }
    // }

    this.loadPaths = (callback) => {
        const __loadPaths = () => {
            loadCompactedPathKeys((err, compactedKeys) => {
                if (err) {
                    return callback(err);
                }

                loadScatteredPathKeys(async (err, scatteredKeys) => {
                    if (err) {
                        return callback(err);
                    }


                    callback(undefined, {...compactedKeys, ...scatteredKeys});
                })
            });
        }
        __loadPaths();
    }

    const loadScatteredPathKeys = (callback) => {
        const pathKeyMap = {};
        const table = constants.TABLE_NAMES.SCATTERED_PATH_KEYS;
        enclaveDSU.getAllRecords("", table, async (err, records) => {
            if (err) {
                return callback(err);
            }
            if (records == undefined) {
                return callback(undefined, pathKeyMap);
            }
            records.forEach(record => {
                pathKeyMap[record.specificString] = record.identifier;
            });

            callback(undefined, pathKeyMap);
        })
        // enclaveDSU.listFiles(constants.PATHS.SCATTERED_PATH_KEYS, async (err, files) => {
        //     if (err) {
        //         return callback(err);
        //     }

        //     for (let i = 0; i < files.length; i++) {
        //         const { key, value } = getKeyValueFromPath(files[i]);
        //         pathKeyMap[key] = value;
        //     }

        //     callback(undefined, pathKeyMap);
        // });
    }

    const loadCompactedPathKeys = (callback) => {
        let pathKeyMap = {};
        // const compactedValuesLocation = constants.PATHS.COMPACTED_PATH_KEYS;
        // enclaveDSU.listFiles(compactedValuesLocation, async (err, files) => {
        //     if (err) {
        //         return callback(err);
        //     }

        //     try {
        //         for (let i = 0; i < files.length; i++) {
        //             const filePath = pathModule.join(compactedValuesLocation, files[i]);
        //             let compactedFileContent = await $$.promisify(enclaveDSU.readFile)(filePath);
        //             compactedFileContent = compactedFileContent.toString();
        //             const partialKeyMap = mapFileContent(compactedFileContent);
        //             pathKeyMap = { ...pathKeyMap, ...partialKeyMap };
        //         }
        //     } catch (e) {
        //         return callback(e);
        //     }


        //     callback(undefined, pathKeyMap);
        // });
        callback(undefined, pathKeyMap);
    }

    // const mapFileContent = (fileContent) => {
    //     const pathKeyMap = {};
    //     const fileLines = fileContent.split("\n");
    //     for (let i = 0; i < fileLines.length; i++) {
    //         const splitLine = fileLines[i].split(" ");
    //         pathKeyMap[splitLine[0]] = splitLine[1];
    //     }

    //     return pathKeyMap;
    // }

    utilsAPI.bindAutoPendingFunctions(this);
    init();
}

module.exports = {LokiDBPathStrategy};