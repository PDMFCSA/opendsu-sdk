console.log("\n|+++++++++++++++++\n|TestRunner params\n| --directory='path_to_a_test_dir' \n| --config='path_to_a_config_file'\n|+++++++++++++++++\n");

const path = require("path");

let config = null;
let parg = process.processedArgv;

if (parg) {
    if (parg.directory) {
        config = {"testDirs": [path.resolve(parg.directory)]};
    }
    if (parg.config) {
        config = require(parg.config);
    }
}

const core = {};
require('../lib/runner').init(core);
const testRunner = core.testRunner;

testRunner.start(config, callback);

function callback(error, result) {
    let exitCode = 0;
    if (error) {
        console.error(error);
        exitCode = 1;
    } else {
        if (!result) {
            console.log("Report and results are above, please check console!");
        } else {
            console.log("Finished!");
            if (result.failed > 0) {
                console.log("Setting exit code 1 because we have failed tests.");
                exitCode = 1;
            }
        }
    }
    process.exit(exitCode);
}