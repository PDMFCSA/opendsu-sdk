const openDSU = require("opendsu");
const w3cDID = openDSU.loadAPI("w3cdid");
const keySSISpace = openDSU.loadAPI("keyssi");
const enclaveAPI = openDSU.loadAPI("enclave");

const path = require("path");
const fs = require("fs");

function CloudEnclaveBootService(server) {
    const processList = {}
    this.createEnclave = async (req, res) => {
        const key = require('crypto').randomBytes(16).toString("base64")
        const didDocument = await $$.promisify(w3cDID.createIdentity)("key", undefined, key);
        this.createFolderForDID(didDocument.getIdentifier(), (err) => {
            if (err) {
                console.debug("Failed to create folder for DID in order to create enclave.", err);
                res.end("Failed to create folder for DID in order to create enclave.");
            }
            // initEnclave(logger, didDocument, didDir);
            //to do
            res.end(didDocument.getIdentifier());
        })

    }

    this.bootEnclave = async (enclaveConfig) => {
        const child = require("child_process").fork(path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, ".", __dirname, "./CloudEnclave.js"), [JSON.stringify(enclaveConfig)]);
        const listenForMessage = () => {
            return new Promise((resolve) => {
                child.on('message', (didIdentifier) => {
                    processList[didIdentifier] = child;
                    resolve();
                });
            });
        };

        await listenForMessage();
    }

    this.bootEnclaves = async () => {
        const configFolder = this.getConfigFolder();
        const _boot = async () => {
            const enclaveConfigFolders = fs.readdirSync(configFolder).filter(file => fs.statSync(path.join(configFolder, file)).isDirectory());
            for (let i = 0; i < enclaveConfigFolders.length; i++) {
                const enclaveConfigFolder = enclaveConfigFolders[i];
                const enclaveConfigFile = fs.readdirSync(path.join(configFolder, enclaveConfigFolder)).find(file => file.endsWith(".json"));
                if (enclaveConfigFile) {
                    const enclaveConfig = JSON.parse(fs.readFileSync(path.join(configFolder, enclaveConfigFolder, enclaveConfigFile)));
                    enclaveConfig.rootFolder = this.getStorageFolder();
                    enclaveConfig.configLocation = configFolder;
                    await this.bootEnclave(enclaveConfig);
                }
            }

            return server.dispatchEvent("initialised", Object.keys(processList));
        }

        const scApi = require("opendsu").loadApi("sc");
        const sc = scApi.getSecurityContext();
        if (sc.isInitialised()) {
            return await _boot();
        }
        sc.on("initialised", async () => {
            return await _boot();
        });
    }
    const initAudit = async (currentDID, auditDID) => {
        const clientSeedSSI = keySSISpace.createSeedSSI("vault", "other secret");
        const clientDIDDocument = await $$.promisify(w3cDID.createIdentity)("ssi:key", clientSeedSSI);

        const auditClient = enclaveAPI.initialiseRemoteEnclave(clientDIDDocument.getIdentifier(), auditDID);
        auditClient.on("initialised", () => {
            this.main.auditClient = auditClient;
            this.main.addEnclaveMethod("audit", (...args) => {
                auditClient.callLambda("addAudit", ...args, server.serverConfig.name, () => {
                });
            })
            server.initialised = true;
            server.dispatchEvent("initialised", currentDID);
        })

    }

    const loadLambdas = (cloudEnclaveProcess, server) => {
        const lambdasPath = server.serverConfig.lambdas;
        try {
            fs.readdirSync(lambdasPath).forEach(file => {
                if (file.endsWith(".js")) {
                    const importedObj = require(lambdasPath + "/" + file);
                    for (let prop in importedObj) {
                        if (typeof importedObj[prop] === "function") {
                            importedObj[prop](cloudEnclaveProcess);
                        }
                    }
                }
            })
        } catch (err) {
            server.dispatchEvent("error", err);
        }
    }

    this.getStorageFolder = () => {
        return path.resolve(server.serverConfig.rootFolder);
    }

    this.getConfigFolder = () => {
        return path.resolve(server.serverConfig.configLocation);
    }
}


module.exports = {
    CloudEnclaveBootService
};
