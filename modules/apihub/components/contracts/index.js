module.exports = {};
//experiemental feature, will be removed from now

// const {
//     ensureContractConstitutionIsPresent,
//     getNodeWorkerBootScript,
//     validateCommandInput,
//     validatePostCommandInput,
// } = require("./utils");
//
// function Contract(server) {
//     const logger = $$.getLogger("Contract", "apihub/contracts");
//     const config = require("../../config");
//
//     const serverUrl = `${server.protocol}://${config.getConfig("host")}:${config.getConfig("port")}`;
//
//     const syndicate = require("syndicate");
//     const { requestBodyJSONMiddleware, responseModifierMiddleware } = require("../../utils/middlewares");
//
//     const allDomainsWorkerPools = {};
//
//     const isWorkerPoolRunningForDomain = (domain) => allDomainsWorkerPools[domain] && allDomainsWorkerPools[domain].isRunning;
//
//     const getDomainWorkerPool = async (domain, callback) => {
//         if (allDomainsWorkerPools[domain]) {
//             return callback(null, allDomainsWorkerPools[domain].pool);
//         }
//
//         let domainConfig = config.getDomainConfig(domain);
//         if (!domainConfig) {
//             return callback(new Error('Domain is not configured'));
//         }
//
//         domainConfig = { ...domainConfig }
//         ensureContractConstitutionIsPresent(domain, domainConfig);
//         if (!domainConfig.contracts.constitution) {
//             return callback(`[Contracts] Cannot boot worker for domain '${domain}' due to missing constitution`);
//         }
//
//         const validatorDID = config.getConfig("validatorDID");
//         if (!validatorDID) {
//             return callback(`[Contracts] Cannot boot worker for domain '${domain}' due to missing validatorDID`);
//         }
//
//         logger.debug(`[Contracts] Starting contract handler for domain '${domain}'...`, domainConfig);
//
//         const { rootFolder } = server;
//         const externalStorageFolder = require("path").join(rootFolder, config.getConfig("externalStorage"));
//         const script = getNodeWorkerBootScript(validatorDID, domain, domainConfig, rootFolder, externalStorageFolder, serverUrl);
//         const pool = syndicate.createWorkerPool({
//             bootScript: script,
//             maximumNumberOfWorkers: 1,
//             workerOptions: {
//                 eval: true,
//             },
//         });
//         allDomainsWorkerPools[domain] = {
//             pool,
//             isRunning: false,
//         };
//
//         callback(null, pool);
//     };
//
//     const responseError = (err) => {
//         let resError = err;
//         if (err instanceof Error) {
//             resError = {
//                 message: err.message,
//             };
//
//             if (err.debug_message) {
//                 resError.debugMessage = err.debug_message;
//             }
//
//             if (err.stack) {
//                 resError.stack = err.stack;
//             }
//
//             if (err.previousError) {
//                 resError.previousError = responseError(err.previousError);
//             }
//         }
//
//         resError = JSON.stringify(resError);
//         return resError;
//     }
//
//     const sendCommandToWorker = (command, response, mapSuccessResponse) => {
//         getDomainWorkerPool(command.domain, (err, workerPool) => {
//             if (err) {
//                 return response.send(400, responseError(err));
//             }
//
//             workerPool.addTask(command, (err, message) => {
//                 allDomainsWorkerPools[command.domain].isRunning = true;
//
//                 if (err) {
//                     return response.send(500, responseError(err));
//                 }
//
//                 let { error, result } = message;
//
//                 if (error) {
//                     return response.send(500, responseError(error));
//                 }
//
//                 if (result && result.optimisticResult) {
//                     if (result.optimisticResult instanceof Uint8Array) {
//                         // convert Buffers to String to that the result could be send correctly
//                         result.optimisticResult = Buffer.from(result.optimisticResult).toString("utf-8");
//                     } else {
//                         try {
//                             result.optimisticResult = JSON.parse(result.optimisticResult);
//                         } catch (error) {
//                             // the response isn't a JSON so we keep it as it is
//                         }
//                     }
//                 }
//
//                 if (typeof mapSuccessResponse === "function") {
//                     result = mapSuccessResponse(result);
//                 }
//
//                 return response.send(200, result);
//             });
//         });
//     };
//
//     const sendGetBdnsEntryToWorker = (request, response) => {
//         const { domain, entry } = request.params;
//         if (!entry || typeof entry !== "string") {
//             return response.send(400, "Invalid entry specified");
//         }
//         if (!isWorkerPoolRunningForDomain(domain)) {
//             return response.send(500, "Contracts not booted");
//         }
//
//         const command = {
//             domain,
//             contractName: "bdns",
//             methodName: "getDomainEntry",
//             params: [entry],
//             type: "safe",
//         };
//         const mapSuccessResponse = (result) => (result ? result.optimisticResult : null);
//         sendCommandToWorker(command, response, mapSuccessResponse);
//     };
//
//     const sendLatestBlockInfoCommandToWorker = (request, response) => {
//         const { domain } = request.params;
//         const command = { domain, type: "latestBlockInfo" };
//         sendCommandToWorker(command, response);
//     };
//
//     const sendSafeCommandToWorker = (request, response) => {
//         const { domain } = request.params;
//         const command = { ...request.body, domain, type: "safe" };
//         sendCommandToWorker(command, response);
//     };
//
//     const sendNoncedCommandToWorker = (request, response) => {
//         const { domain } = request.params;
//         const command = { ...request.body, domain, type: "nonced" };
//         sendCommandToWorker(command, response);
//     };
//
//     const sendPBlockToValidateToWorker = (request, response) => {
//         const { domain } = request.params;
//         const message = request.body;
//         const command = { domain, type: "validatePBlockFromNetwork", params: [message] };
//         sendCommandToWorker(command, response);
//     };
//
//     const sendValidatorNonInclusionToWorker = (request, response) => {
//         const { domain } = request.params;
//         const message = request.body;
//         const command = { domain, type: "setValidatorNonInclusion", params: [message] };
//         sendCommandToWorker(command, response);
//     };
//
//     server.use(`/contracts/:domain/*`, responseModifierMiddleware);
//     server.use(`/contracts/:domain/*`, requestBodyJSONMiddleware);
//     server.use(`/contracts/:domain/*`, validateCommandInput);
//     server.post(`/contracts/:domain/*`, validatePostCommandInput);
//
//     server.get(`/contracts/:domain/bdns-entries/:entry`, sendGetBdnsEntryToWorker);
//     server.get(`/contracts/:domain/latest-block-info`, sendLatestBlockInfoCommandToWorker);
//     server.post(`/contracts/:domain/safe-command`, sendSafeCommandToWorker);
//     server.post(`/contracts/:domain/nonced-command`, sendNoncedCommandToWorker);
//     server.post(`/contracts/:domain/pblock-added`, sendPBlockToValidateToWorker);
//     server.post(`/contracts/:domain/validator-non-inclusion`, sendValidatorNonInclusionToWorker);
// }
//
// module.exports = Contract;
