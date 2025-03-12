const Middleware = require("./lib/Middleware");
let middlewareInstance = new Middleware();

exports.getMiddleware = function () {
    return middlewareInstance;
};
