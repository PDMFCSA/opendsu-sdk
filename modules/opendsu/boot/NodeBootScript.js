function boot(keySSI) {
    $$.LEGACY_BEHAVIOUR_ENABLED = true;
    const worker_threads = "worker_threads";
    const {parentPort} = require(worker_threads);
    const {handleMessage} = require("./boot-utils.js");

    parentPort.on("message", (message) => {
        handleMessage(message, (error, result) => {
            parentPort.postMessage({error, result});
        });
    });

    process.on("uncaughtException", (err) => {
        console.error("[worker] unchaughtException inside worker", err);
        setTimeout(() => {
            process.exit(1);
        }, 100);
    });

    function getKeySSI(callback) {
        callback(null, keySSI);
    }

    const BootEngine = require("./BootEngine.js");

    console.log(`[worker] booting DSU for keySSI ${keySSI}...`);

    const booter = new BootEngine(getKeySSI);

    booter.boot((error) => {
        if (error) {
            parentPort.postMessage({error});
            throw error;
        }

        console.log("[worker] ready");
        parentPort.postMessage("ready");
    });
}

module.exports = boot;
