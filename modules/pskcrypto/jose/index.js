if ($$.environmentType === "browser") {
    module.exports = require("./browser");
} else {
    module.exports = require("./node");
}