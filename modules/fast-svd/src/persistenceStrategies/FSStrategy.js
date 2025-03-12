function FSStrategy(rootPath) {
    let fs = require('fs');
    let path = require('path');
    let crypto = require('opendsu').loadApi('crypto');

    let lockedSVds = {};

    this.lock = function (uid, transactionHandler) {
        let stringUID = uid.getUID();
        if (lockedSVds[uid] != undefined) {
            throw new Error("SVD already locked by transaction  " + lockedSVds[stringUID] + " and " + transactionHandler + " tried to lock it again)");
        }
        lockedSVds[stringUID] = transactionHandler;
    }

    this.storeAndUnlock = function (diff, transactionHandler, callback) {
        let parallelTaskRunner = require("../util/parallelTask").createNewParallelTaskRunner(callback);
        let self = this;

        let getTask = function (entry) {
            return (callback) => {
                //console.log("storeAndUnlock: ", entry.uid, " with ", entry.changes.length, " changes: ", entry.changes);
                saveSVD(entry.uid, entry.state, entry.changes, entry.signature, callback);
                lockedSVds[entry.uid] = undefined;
            }
        }
        diff.forEach(entry => {
            parallelTaskRunner.addTask(getTask(entry));
        });
    }


    this.abortLocks = function (diff, transactionHandler) {
        diff.forEach(entry => {
            if (lockedSVds[entry.uid] != transactionHandler) {
                console.error("Transaction " + transactionHandler + " tried to abort transaction " + lockedSVds[entry.uid] + "on " + entry.uid + "without owning the lock")
            } else {
                lockedSVds[entry.uid] = undefined;
            }
        });
    }

    this.loadState = function (uid, callback) {
        let stringUID = uid.getUID();
        const base58UID = crypto.encodeBase58(stringUID)

        fs.readFile(path.join(rootPath, base58UID, "state"), 'utf8', function (err, res) {
            if (err) {
                return callback(err);
            }
            let obj;
            try {
                obj = JSON.parse(res);
            } catch (err) {
                callback(err);
            }
            callback(undefined, obj);
        });
    }

    function saveSVD(stringUID, svdState, changes, signature, callback) {
        const base58UID = crypto.encodeBase58(stringUID)
        let dirPath = path.join(rootPath, base58UID);
        fs.mkdir(dirPath, function () {
            fs.writeFile(path.join(dirPath, "state"), JSON.stringify(svdState), function () {
                let auditEntry = {
                    changes: changes,
                    signature: signature
                }
                //make stringify as an audit single line removing all newlines
                let auditLogLine = JSON.stringify(auditEntry).replace(/\n/g, " ");
                fs.appendFile(path.join(rootPath, base58UID, "history"), auditLogLine + "\n", callback);
            });
        });
    }

    function checkPathExistence() {
        if (!fs.existsSync(rootPath)) {
            fs.mkdirSync(rootPath);
        }
    }

    checkPathExistence();
}

module.exports = FSStrategy;