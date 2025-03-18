function ClientCredentialsOauth(server) {
    const config = require("../../http-wrapper/config");
    const jwksEndpoint = config.getConfig("oauthJWKSEndpoint");
    const util = require("../oauth/lib/util");

    server.use(async (req, res, next) => {
        if (req.skipClientCredentialsOauth) {
            return next();
        }

        if (!req.headers.authorization) {
            return next();
        }

        const token = req.headers.authorization.split(" ")[1];
        util.validateAccessToken(jwksEndpoint, token, (err) => {
            if (err) {
                res.statusCode = 401;
                util.printDebugLog(`Failed to validate OAuth token: ${err}`)
                return res.end("Invalid token");
            }

            req.headers["user-id"] = util.getSSODetectedIdFromPayload(util.parseAccessToken(token).payload);
            req.skipSSO = true
            next();
        })
    });
}


module.exports = ClientCredentialsOauth;