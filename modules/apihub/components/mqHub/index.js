const URL_PREFIX = "/mq";
//known implementations for the MQ adapters
const adapterImpls = {
    local: require("./adapters/localMQAdapter.js"),
    solace: require("./adapters/solaceMQAdapter.js"),
    loki: require("./adapters/lokiMQAdapter.js"),
    couch: require("./adapters/couchMQAdapter.js"),
    lightdb: require("./adapters/lighDBEnclaveAdapter.js")
};

const defaultSettings = {
    // normally there are gateways timeouts of 30seconds
    mq_client_timeout: 60 * 1000,//sec
    // not sure about the response.setTimeout(msecs[, callback]) available on nodejs docs

    mq_throttling: 100, //100 per second
    mq_allow_unregistered_did: false
}

async function MQHub(server, signalAsyncLoading, doneLoading) {

    server.registerAccessControlAllowHeaders(["token", "authorization", "x-mq-authorization"]);

    const logger = $$.getLogger("MQHub", "apihub/mqHub");

    signalAsyncLoading();

    const config = require("../../http-wrapper/config/index");

    const JWTIssuer = require("./auth/JWTIssuer");
    const issuer = new JWTIssuer(server.rootFolder);

    let domains = []; //config.getConfiguredDomains();

    function getTokenHandler(request, response) {
        const domain = request.params.domain;
        issuer.createToken(domain, {credentials: request.params.hashDID}, (err, tokenObj) => {
            if (err) {
                logger.info(0x03, "Not able to create a new token.", err);
                response.statusCode = 500;
                return response.end();
            }

            const mqConfig = config.getConfig("componentsConfig", "mq");
            if (mqConfig && mqConfig.connectionTimeout) {
                response.writeHead(200, {
                    "connection-timeout": mqConfig.connectionTimeout
                });
            } else {
                response.statusCode = 200;
            }

            response.write(JSON.stringify(tokenObj));
            response.end();
        });
    }

    async function allowUnregisteredDID(domainName) {
        const domainConfig = await config.getSafeDomainConfig(domainName);
        let allowUnregisteredDID = defaultSettings.mq_allow_unregistered_did;
        if (domainConfig && typeof domainConfig.mq_allow_unregistered_did !== "undefined") {
            allowUnregisteredDID = !!domainConfig.mq_allow_unregistered_did;
        }
        return allowUnregisteredDID;
    }

    async function putMessageHandler(request, response, next) {
        const domainName = request.params.domain;
        if (domains.indexOf(domainName) === -1) {
            logger.info(0x03, `Caught an request to the MQs for domain ${domainName}. Looks like the domain doesn't have mq component enabled.`);
            response.statusCode = 405;
            response.end();
            return;
        }

        let token = request.headers['x-mq-authorization'];

        if (!await allowUnregisteredDID(domainName) && !token) {
            logger.info(0x03, `No token was available on the request and the domain ${domainName} configuration prohibits unregisteredDIDs to use the MQ api.`);
            response.statusCode = 403;
            response.end();
            return;
        }

        issuer.validateToken(token, (err, valid) => {
            let errorMsg = "Not able to validate token: ";
            if (!valid) {
                errorMsg = "Token not valid: ";
            }
            if (err || !valid) {
                logger.info(0x03, `${errorMsg} < ${token} >`, err ? err : "");
                response.statusCode = 403;
                response.end();
                return;
            }

            //all good continue to the domain specific mq handler
            return next();
        });
    }

    async function getMessageHandler(request, response, next) {
        const domainName = request.params.domain;
        if (domains.indexOf(domainName) === -1) {
            logger.info(0x03, `Caught an request to the MQs for domain ${domainName}. Looks like the domain doesn't have mq component enabled.`);
            response.statusCode = 405;
            response.end();
            return;
        }

        let token = request.headers['x-mq-authorization'];

        if (!await allowUnregisteredDID(domainName) && !token) {
            logger.info(0x03, `No token was available on the request and the domain ${domainName} configuration prohibits unregisteredDIDs to use the MQ api.`);
            response.statusCode = 403;
            response.end();
            return;
        }

        issuer.isOwner(token, request.params.hashDID, (err, isOwner) => {
            let errorMsg = "Not able to validate authorization token: ";
            if (!isOwner) {
                errorMsg = "Ownership not confirmed based on token: ";
            }
            if (err || !isOwner) {
                logger.info(0x03, `${errorMsg} < ${token} >`, err ? err : "");
                response.statusCode = 403;
                response.end();
                return;
            }

            //all good continue to the domain specific mq handler
            return next();
        });
    }

    function deleteMessageHandler(request, response, next) {
        getMessageHandler(request, response, next);
    }

    function takeMessageHandler(request, response, next) {
        getMessageHandler(request, response, next);
    }

    server.get(`${URL_PREFIX}/:domain/:hashDID/token`, getTokenHandler); //> JWT Token

    server.put(`${URL_PREFIX}/:domain/put/:hashDID`, putMessageHandler); //< message

    server.get(`${URL_PREFIX}/:domain/get/:hashDID/:signature_of_did`, getMessageHandler); //  > {message}
    server.delete(`${URL_PREFIX}/:domain/delete/:hashDID/:messageID/:signature_of_did`, deleteMessageHandler);

    server.get(`${URL_PREFIX}/:domain/take/:hashDID/:signature_of_did`, takeMessageHandler); //  > message

    function testIfMQEnabled(domain, domainToBeUsedByAdapter) {
        let domainConfig = config.getDomainConfig(domain);

        if (domainConfig && domainConfig.enable && domainConfig.enable.indexOf("mq") !== -1) {
            const adapterTypeName = domainConfig["mq_type"] || "lightdb";
            const adapter = adapterImpls[adapterTypeName];
            if (!adapter) {
                logger.info(0x03, `Not able to recognize the mq_type < ${adapterTypeName} > from the domain < ${domain} > config.`);
                return;
            }

            try {
                logger.debug(`Preparing to register mq endpoints for domain < ${domain} > ... `);
                adapter(server, URL_PREFIX, domainToBeUsedByAdapter || domain, domainConfig);
            } catch (err) {
                logger.info(0x03, `Caught an error during initialization process of the mq for domain < ${domain} >`, err);
                return;
            }

            return true;
        }
    }

    async function setupDomainSpecificHandlers() {
        let confDomains = typeof config.getConfiguredDomains !== "undefined" ? config.getConfiguredDomains() : ["default"];
        try {
            let adminService = require("./../../components/admin").getAdminService();
            let getDomains = $$.promisify(adminService.getDomains);
            let virtualDomains = await getDomains();
            for (let i = 0; i < virtualDomains.length; i++) {
                let domainInfo = virtualDomains[i];
                if (domainInfo && domainInfo.active && domainInfo.cloneFromDomain) {
                    if (testIfMQEnabled(domainInfo.cloneFromDomain, domainInfo.pk)) {
                        logger.debug(`Successfully register mq endpoints for virtual domain < ${domainInfo.pk} >.`);
                        domains.push(domainInfo.pk);
                    }
                }
            }
        } catch (err) {
            if (err.rootCause && err.rootCause !== "disabled-by-config") {
                logger.warning('Failed to enable mq handler for virtual domains', err);
            }
        }

        for (let i = 0; i < confDomains.length; i++) {
            let domain = confDomains[i];
            if (testIfMQEnabled(domain)) {
                logger.debug(`Successfully register mq endpoints for domain < ${domain} >.`);
                domains.push(domain);
            }
        }
    }

    await setupDomainSpecificHandlers();
    doneLoading();
}

module.exports = {
    MQHub
};
