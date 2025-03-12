function VersionlessDSUFactory() {
    const VersionlessDSU = require("../../dsu/VersionlessDSU");

    /**
     * @param {object} options
     * @param {string} options.addLog boolean, specify if log create entry should be added
     * @param {callback} callback
     */
    this.create = (keySSI, options, callback) => {
        if (typeof options === "function") {
            callback = options;
            options = undefined;
        }

        if (typeof options === "undefined") {
            options = {};
        }

        const versionlessDSU = new VersionlessDSU({keySSI});

        const initCallback = (error, result) => {
            if (error) {
                return callback(error);
            }

            if (options.addLog) {
                return versionlessDSU.dsuLog(`DSU created on ${Date.now()}`, (err) => {
                    callback(err, result);
                });
            }
            callback(undefined, result);
        };

        versionlessDSU.init(initCallback);
    };

    /**
     * @param {string} keySSI
     * @param {object} options
     * @param {callback} callback
     */
    this.load = (keySSI, options, callback) => {
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        const versionlessDSU = new VersionlessDSU({keySSI});
        versionlessDSU.load(callback);
    };
}

module.exports = VersionlessDSUFactory;
