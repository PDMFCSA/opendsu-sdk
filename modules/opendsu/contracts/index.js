const getBaseURL = require("../utils/getBaseURL");

const {
    DomainNotSupportedError,
    getSafeCommandBody,
    getNoncedCommandBody,
    getContractEndpointUrl,
    callContractEndpoint,
    callContractEndpointUsingBdns,
} = require("./utils");

class CommandSender {
    constructor(baseUrl, fallbackToUrlFromBDNS) {
        this.baseUrl = baseUrl;
        this.fallbackToUrlFromBDNS = fallbackToUrlFromBDNS;
    }

    async sendCommand(method, contractEndpointPrefix, domain, commandBody, callback) {
        if (typeof commandBody === "function") {
            callback = commandBody;
            commandBody = null;
        }

        callback = $$.makeSaneCallback(callback);

        try {
            try {
                // try to send the command to the current apihub endpoint
                const currentApihubUrl = getContractEndpointUrl(this.baseUrl, domain, contractEndpointPrefix);
                const response = await callContractEndpoint(currentApihubUrl, method, domain, commandBody);
                callback(null, response);
            } catch (error) {
                // if the current apihub endpoint doesn't handle the current domain, then send the command using BDNS
                if (this.fallbackToUrlFromBDNS && error instanceof DomainNotSupportedError) {
                    callContractEndpointUsingBdns(method, contractEndpointPrefix, domain, commandBody, callback);
                    return;
                }
                throw error;
            }
        } catch (error) {
            OpenDSUSafeCallback(callback)(
                createOpenDSUErrorWrapper(`Failed to execute domain contract method: ${JSON.stringify(commandBody)}`, error)
            );
        }
    }

    generateSafeCommand(domain, contractName, methodName, params, callback) {
        if (typeof params === "function") {
            callback = params;
            params = null;
        }

        try {
            const commandBody = getSafeCommandBody(domain, contractName, methodName, params);
            this.sendCommand("POST", "safe-command", domain, commandBody, callback);
        } catch (error) {
            callback(error);
        }
    }

    async generateNoncedCommand(signerDID, domain, contractName, methodName, params, timestamp, callback) {
        if (typeof timestamp === "function") {
            callback = timestamp;

            // check if the param before provided callback is either the timestamp or the params, since both are optional
            if (typeof params === "number") {
                timestamp = params;
                params = null;
            } else {
                timestamp = null;
            }
        }

        if (typeof params === "function") {
            callback = params;
            params = null;
            timestamp = null;
        }
        if (!signerDID) {
            return callback("signerDID not provided");
        }

        if (!timestamp) {
            timestamp = Date.now();
        }

        try {
            if (typeof signerDID === "string") {
                // signerDID contains the identifier, so we need to load the DID
                const w3cDID = require("opendsu").loadAPI("w3cdid");
                signerDID = await $$.promisify(w3cDID.resolveDID)(signerDID);
            }

            const latestBlockInfo = await $$.promisify(this.sendCommand.bind(this))("GET", "latest-block-info", domain);
            const {number: blockNumber} = latestBlockInfo;

            const commandBody = await getNoncedCommandBody(domain, contractName, methodName, params, blockNumber, timestamp, signerDID);
            this.sendCommand("POST", "nonced-command", domain, commandBody, callback);
        } catch (error) {
            callback(error);
        }
    }
}

function generateSafeCommand(domain, contractName, methodName, params, callback) {
    const commandSender = new CommandSender(getBaseURL(), true);
    commandSender.generateSafeCommand(domain, contractName, methodName, params, callback);
}

async function generateNoncedCommand(signerDID, domain, contractName, methodName, params, timestamp, callback) {
    const commandSender = new CommandSender(getBaseURL(), true);
    commandSender.generateNoncedCommand(signerDID, domain, contractName, methodName, params, timestamp, callback);
}

function generateSafeCommandForSpecificServer(serverUrl, domain, contractName, methodName, params, callback) {
    if (!serverUrl || typeof serverUrl !== "string") {
        throw new Error(`Invalid serverUrl specified`);
    }
    const commandSender = new CommandSender(serverUrl);
    commandSender.generateSafeCommand(domain, contractName, methodName, params, callback);
}

function generateNoncedCommandForSpecificServer(
    serverUrl,
    signerDID,
    domain,
    contractName,
    methodName,
    params,
    timestamp,
    callback
) {
    if (!serverUrl || typeof serverUrl !== "string") {
        throw new Error(`Invalid serverUrl specified`);
    }
    const commandSender = new CommandSender(serverUrl);
    commandSender.generateNoncedCommand(signerDID, domain, contractName, methodName, params, timestamp, callback);
}

module.exports = {
    generateSafeCommand,
    generateNoncedCommand,
    generateSafeCommandForSpecificServer,
    generateNoncedCommandForSpecificServer,
};
