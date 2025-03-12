function CloudEnclave(config) {
    const fs = require("fs");
    const path = require("path");
    require(path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, "builds", "output", "pskWebServer.js"))
    const {MessageDispatcher} = require("./MessageDispatcher");
    const PersistenceFactory = require("./PersistenceFactory");
    const SecurityDecorator = require("./SecurityDecorator");
    config = JSON.parse(config);
    if (!config.name) {
        config.name = "main";
    }
    if (!config.persistence) {
        config.persistence = {
            type: "loki",
            options: [path.join(config.rootFolder, config.name, "db")]
        }
    }
    if (!config.lambdasPath) {
        config.lambdasPath = path.join(config.configLocation, config.name, "lambdas");
    }
    const persistence = PersistenceFactory.create(config.persistence.type, ...config.persistence.options);
    const securityDecorator = new SecurityDecorator(persistence);
    const openDSU = require("opendsu");
    const utils = openDSU.loadAPI("utils");
    const w3cDID = openDSU.loadAPI("w3cdid");
    const ObservableMixin = utils.ObservableMixin;
    const scAPI = openDSU.loadAPI("sc");

    const sc = scAPI.getSecurityContext();
    ObservableMixin(this);

    const initMessaging = (didDocument) => {
        this.messageDispatcher = new MessageDispatcher(didDocument)
        this.messageDispatcher.waitForMessages((err, commandObject) => {
            this.execute(err, commandObject);
        });
    }

    const loadLambdas = () => {
        const lambdasPath = config.lambdasPath;
        try {
            fs.readdirSync(lambdasPath).forEach(file => {
                if (file.endsWith(".js")) {
                    const importedObj = require(lambdasPath + "/" + file);
                    for (let prop in importedObj) {
                        if (typeof importedObj[prop] === "function") {
                            importedObj[prop](this);
                        }
                    }
                }
            })
        } catch (err) {
            return this.dispatchEvent("error", err);
        }
    }

    const init = async () => {
        let secret = process.env.CLOUD_ENCLAVE_SECRET;
        if (typeof secret === "object") {
            secret = secret[config.name];
        }

        const didDocument = await $$.promisify(w3cDID.resolveNameDID)(config.domain, config.name, secret);
        initMessaging(didDocument);
        loadLambdas();
        console.log("Dispatching initialised event from server securityDecorator process");
        this.initialised = true;
        this.dispatchEvent("initialised");
        process.send(didDocument.getIdentifier());
    }

    this.execute = (err, commandObject) => {
        if (err) {
            console.log(err);
            return;
        }
        const clientDID = commandObject.params.pop();
        console.log("Preparing to execute message for " + clientDID);
        try {
            const command = commandObject.commandName;
            const params = commandObject.params;
            const callback = (err, res) => {
                const resultObj = {
                    "commandResult": res,
                    "commandID": commandObject.commandID
                };

                if (err) {
                    resultObj.commandResult = err;
                    resultObj.error = true;
                }

                this.messageDispatcher.sendMessage(JSON.stringify(resultObj), clientDID);
            }
            params.push(callback);
            securityDecorator[command].apply(securityDecorator, params);
        } catch (err) {
            console.log(err);
            return err;
        }
    }

    this.addEnclaveMethod = (methodName, method) => {
        securityDecorator[methodName] = method;
    }

    if (sc.isInitialised()) {
        console.log("Security context already initialised");
        init();
    } else {
        sc.on("initialised", () => {
            console.log("Security context was initialised");
            init();
        })
    }
}

module.exports = CloudEnclave;

const args = process.argv;
if (args.length > 2) {
    new CloudEnclave(args[2]);
}
