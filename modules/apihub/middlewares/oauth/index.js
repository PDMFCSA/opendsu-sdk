const config = require("../../http-wrapper/config");

const serverAuthentication = config.getConfig("serverAuthentication");
const oAuthConfig = config.getConfig("oauthConfig");

if (oAuthConfig.debugLogEnabled) {
    const logger = $$.getLogger("OAuthMiddleware", "apihub/oauth");
    logger.debug(`Server OAuth debug logging enabled`);
}

if (serverAuthentication) {
    module.exports = require("./lib/OauthMiddleware");
} else {
    module.exports = require("./lib/AccessTokenValidator");
}

