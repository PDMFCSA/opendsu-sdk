require("../../../../builds/output/testsRuntime");

const dc = require("double-check");
const assert = dc.assert;

function generateContent(sizeInMB) {
    let content = "";
    for (let i = 0; i < sizeInMB * 1024 * 1024; i++) {
        content += "a";
    }

    return content;
}

function getEnclaveDB(dbName, autoSaveInterval) {
    const lokiEnclaveFacadeModule = require("../../index");
    let createLokiEnclaveFacadeInstance = lokiEnclaveFacadeModule.createLokiEnclaveFacadeInstance;
    return createLokiEnclaveFacadeInstance(dbName, autoSaveInterval, lokiEnclaveFacadeModule.Adapters.FS);
}

const process = require('node:process');

process.on('uncaughtException', (err, origin) => {
    // fs.writeSync(
    //     process.stderr.fd,
    //     `Caught exception: ${err}\n` +
    //     `Exception origin: ${origin}`,
    // );
    console.log(err + origin)
});


async function insertRecords(testDb, table, number, content) {
    const ids = []
    try {
        for (let i = 0; i < number; i++) {
            try {
                await $$.promisify(testDb.insertRecord)("DID", table, i, {name: `test`, content: content});
                ids.push(i);
            } catch {
            }
        }
    } catch (err) {
        console.log("error inserting record: " + err);
    }

    return ids;
}

try {
    assert.callback("Performance - Enclave db insert test", async (testFinishCallback) => {
        // dc.createTestFolder("enclaveDBTest", async function (err, folder) {
        try {
            const path = require("path");
            const folder = path.join(require("os").tmpdir(), "enclaveDBTest12341");
            const fs = require("fs");
            fs.mkdirSync(folder, {recursive: true});
            let dbPath = path.join(folder, "performance_test_db");
            console.log("dbPath: " + dbPath);
            let testDb = getEnclaveDB(dbPath, 1);
            let NO_TABLES = 10;
            const number = 2;
            for (let i = 0; i < NO_TABLES; i++) {
                const tableName = `table${i}`;
                // $$.promisify(testDb.createCollection)("", tableName, ["pk"]);
                let time;
                let start;
                // Big size
                start = new Date().getTime();
                const content = generateContent(10);
                await insertRecords(testDb, tableName, number, content);
                time = new Date().getTime() - start;

                console.log(`Inserted ${number} big size records in ${time}ms`);
            }

            // const records1 = await $$.promisify(testDb.getAllRecords)("", "table1");
            // console.log("Records: " + records1.length);
            // const records2 = await $$.promisify(testDb2.getAllRecords)("", "table1");
            // console.log("Records: " + records2.length);
            //create sleep function

        } catch (err) {
            console.log(err);
        }
        setTimeout(() => {
            try {
                testFinishCallback();
            } catch (err) {
                console.log("Error finishing test: " + err);
            }
        }, 1000);
    }, 600000)
} catch (err) {
    console.log("Error at end" + err);
}
