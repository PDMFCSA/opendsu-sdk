function setupGenericErrorMiddleware(server) {
    const constants = require("./../../moduleConstants");
    const logger = $$.getLogger("setupGenericErrorMiddleware", "apihub/genericErrorMiddleware");

    server.use(function (req, res, next) {
        const capturedWrites = [];

        const originalResWrite = res.write;
        const originalResEnd = res.end;

        res.write = function (chunk, encoding, callback) {
            if (typeof callback === "function" || typeof encoding === "function") {
                logger.debug(`${constants.LOG_IDENTIFIER}`,
                    "Generic Error Middleware is running and has detected that a callback was used for response.write method call.",
                    "Be aware that this middleware can generate undesired behaviour in this case.", new Error());
            }
            capturedWrites.push([chunk, encoding, callback]);
        }

        res.end = function (data, encoding, callback) {
            if (res.statusCode < 400) {
                for (let i = 0; i < capturedWrites.length; i++) {
                    originalResWrite.call(res, ...capturedWrites[i]);
                }
                originalResEnd.call(res, data, encoding, callback);
            } else {
                if (req.log) {
                    for (let i = 0; i < capturedWrites.length; i++) {
                        req.log("Generic Error Middleware prevented message to be sent on response.write", ...capturedWrites[i]);
                    }
                    if (data) {
                        req.log("Generic Error Middleware prevented message to be sent on response.end", data);
                    }
                }
                originalResWrite.call(res, "Error");
                originalResEnd.call(res, undefined, encoding, callback);
            }
        }

        next();
    });

    logger.debug(`${constants.LOG_IDENTIFIER}`, "generic error middleware was loaded. This middleware will prevent any error to leak when sending a >=400 response to the client.");
}

module.exports = setupGenericErrorMiddleware;
