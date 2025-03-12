let apihubConfig;
let tokenIssuers;
let domainConfigs = {};
const logger = $$.getLogger("index", "apihub/config");

function checkIfFileExists(filePath) {
    try {
        const fs = require("fs");
        fs.accessSync(filePath);
        return true;
    } catch (error) {
        logger.error(`File ${filePath} doesn't exists or no access is possible!`);
    }
    return false;
}

function loadAllDomainConfigs(configFolderPath) {
    const path = require("swarmutils").path;
    const fs = require("fs");
    const domainsFolderPath = path.join(configFolderPath, 'domains');
    if (checkIfFileExists(domainsFolderPath)) {
        try {
            fs.readdirSync(domainsFolderPath)
                .filter((domainFile) => domainFile.endsWith(".json"))
                .forEach((domainFile) => {
                    const domain = domainFile.substring(0, domainFile.lastIndexOf("."));
                    logger.debug(`Loading config for domain '${domain}'`);

                    try {
                        const domainConfig = fs.readFileSync(path.join(domainsFolderPath, domainFile));
                        domainConfigs[domain] = JSON.parse(domainConfig);
                    } catch (error) {
                        logger.error(`Could not read config for domain '${domain}'`, error);
                    }
                });
        } catch (error) {
            logger.error(`Could not read domain configs at ${domainsFolderPath}`, error);
        }
    } else {
        logger.error(`Domain configs folder not found at ${domainsFolderPath}`);
    }
}

function ensureConfigsAreLoaded() {
    const path = require("swarmutils").path;

    if (!apihubConfig) {
        let apihubJson;
        if (typeof process.env.PSK_CONFIG_LOCATION === "undefined") {
            logger.debug("PSK_CONFIG_LOCATION env variable not set. Not able to load any external config. Using default configuration.")
            apihubJson = {};
        } else {
            const fs = require("fs");
            const configFolderPath = path.resolve(process.env.PSK_CONFIG_LOCATION);
            logger.debug("Trying to read the apihub.json file from the location pointed by PSK_CONFIG_LOCATION env variable.");
            const apihubConfigPath = path.join(configFolderPath, 'apihub.json');

            if (!checkIfFileExists(apihubConfigPath)) {
                logger.debug("Trying to read the server.json file from the location pointed by PSK_CONFIG_LOCATION env variable.");
                const serverJsonConfigPath = path.join(configFolderPath, 'server.json');

                let serverJson;
                if (checkIfFileExists(serverJsonConfigPath)) {
                    serverJson = JSON.parse(fs.readFileSync(serverJsonConfigPath));
                } else {
                    serverJson = {};
                }

                // migrate server.json to apihub.json
                const configMigrator = require("./config-migrator");
                configMigrator.migrate(serverJson, configFolderPath);
            }

            apihubJson = JSON.parse(fs.readFileSync(apihubConfigPath));
            loadAllDomainConfigs(configFolderPath);
        }

        apihubJson = apihubJson || {};
        apihubConfig = new ApihubConfig(apihubJson);
    }
}

function getConfig(...keys) {
    ensureConfigsAreLoaded();

    if (keys.length === 0) {
        return apihubConfig;
    }

    return getSource(keys, apihubConfig);
}

function ApihubConfig(conf) {
    const defaultConf = require('./default');

    function createConfig(config, defaultConfig) {
        if (typeof config === "undefined") {
            return defaultConfig;
        }

        //ensure that the config object will contain all the necessary keys for server configuration
        for (let mandatoryKey in defaultConfig) {
            if (typeof config[mandatoryKey] === "undefined") {
                config[mandatoryKey] = defaultConfig[mandatoryKey];
            }
        }
        return __createConfigRecursively(conf, defaultConf);

        function __createConfigRecursively(config, defaultConfig) {
            for (let prop in defaultConfig) {
                if (typeof config[prop] === "object" && !Array.isArray(config[prop])) {
                    __createConfigRecursively(config[prop], defaultConfig[prop]);
                } else {
                    if (typeof config[prop] === "undefined") {
                        config[prop] = defaultConfig[prop];
                        __createConfigRecursively(config[prop], defaultConfig[prop]);
                    }
                }
            }
            return config;
        }
    }

    conf = createConfig(conf, defaultConf);
    conf.defaultComponents = defaultConf.activeComponents;
    if (conf.isDefaultComponent) {
        logger.debug("\n\nBe aware that there is a method on the config called isDefaultComponent. You need to check and change your config name.\n\n");
    }
    conf.isDefaultComponent = function (componentName) {
        return defaultConf.activeComponents.indexOf(componentName) !== -1 || defaultConf.componentsConfig[componentName];
    }
    return conf;
}

function getSource(arrayKeys, source) {
    if (!arrayKeys.length || source === undefined) {
        return source;
    }

    return getSource(arrayKeys, source[arrayKeys.shift()]);
}

function getTokenIssuers(callback) {
    const fs = require("fs");
    const path = require("swarmutils").path;

    if (tokenIssuers) {
        return callback(null, tokenIssuers);
    }

    if (typeof process.env.PSK_CONFIG_LOCATION === "undefined") {
        tokenIssuers = [];
        return callback(null, tokenIssuers);
    }

    const filePath = path.join(path.resolve(process.env.PSK_CONFIG_LOCATION), "issuers-public-identities");
    logger.debug(
        `Trying to read the token-issuers.txt file from the location pointed by PSK_CONFIG_LOCATION env variable: ${filePath}`
    );

    fs.access(filePath, fs.F_OK, (err) => {
        if (err) {
            logger.debug(`${filePath} doesn't exist so skipping it`);
            tokenIssuers = [];
            callback(null, tokenIssuers);
        }

        fs.readFile(filePath, "utf8", function (err, data) {
            if (err) {
                logger.error(`Cannot load ${filePath}`, err);
                return;
            }

            const openDSU = require("opendsu");
            const crypto = openDSU.loadApi("crypto");

            tokenIssuers = data.split(/\s+/g).filter((issuer) => issuer).map(issuer => crypto.getReadableSSI(issuer));

            callback(null, tokenIssuers);
        });
    });
}

function getDomainConfigFilePath(domain) {
    const path = require("swarmutils").path;
    const domainConfigPath = path.join(path.resolve(process.env.PSK_CONFIG_LOCATION), `domains/${domain}.json`);
    return domainConfigPath;
}

function getConfiguredDomains() {
    ensureConfigsAreLoaded();
    return Object.keys(domainConfigs);
}

async function getSafeDomainConfig(domain, ...configKeys) {
    let domainConfig = getDomainConfig(domain);
    if (!domainConfig) {
        try {
            let adminService = require("../../components/admin").getAdminService();
            const getDomainInfo = $$.promisify(adminService.getDomainInfo);
            let domainInfo = await getDomainInfo(domain);
            if (domainInfo && domainInfo.active && domainInfo.cloneFromDomain) {
                logger.debug(`Config for domain '${domain}' was loaded from admin service.`);
                return getDomainConfig(domainInfo.cloneFromDomain);
            }
        } catch (err) {
            //we ignore any errors in this try-catch block because admin component may be disabled
        }
    }
    return getDomainConfig(domain, ...configKeys);
}

function getDomainConfig(domain, ...configKeys) {
    ensureConfigsAreLoaded();
    if (!domain) {
        return {};
    }

    const getConfigResult = (config) => {
        if (!configKeys) {
            configKeys = [];
        }
        let configResult = config ? getSource(configKeys, config) : null;
        return configResult;
    }

    const loadedDomainConfig = domainConfigs[domain];
    if (typeof loadedDomainConfig !== 'undefined') {
        return getConfigResult(loadedDomainConfig);
    }

    if (typeof process.env.PSK_CONFIG_LOCATION === "undefined") {
        logger.debug('PSK_CONFIG_LOCATION env variable not set. Not able to load domain config. Using default configuration.')
        return getConfigResult({});
    }

    const domainConfigPath = getDomainConfigFilePath(domain);
    logger.debug(`Trying to read the config for domain '${domain}' at location: ${domainConfigPath}`);

    try {
        const fsName = "fs";
        const domainConfigContent = require(fsName).readFileSync(domainConfigPath);
        const domainConfig = JSON.parse(domainConfigContent);
        domainConfigs[domain] = domainConfig;
        return getConfigResult(domainConfig);
    } catch (error) {
        logger.error(`Config for domain '${domain}' cannot be loaded from location: ${domainConfigPath}.`);
        domainConfigs[domain] = null;
        return domainConfigs[domain];
    }
}

function updateDomainConfig(domain, config, callback) {
    ensureConfigsAreLoaded();
    const domainConfigPath = getDomainConfigFilePath(domain);
    const fsName = "fs";
    require(fsName).writeFile(domainConfigPath, JSON.stringify(config), (error) => {
        if (error) {
            return callback(error);
        }

        // update the domain config cache
        domainConfigs[domain] = config;
        callback();
    })
}

module.exports = {
    getConfig,
    getTokenIssuers,
    getConfiguredDomains,
    getDomainConfig,
    getSafeDomainConfig,
    updateDomainConfig
};
