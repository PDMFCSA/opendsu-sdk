/*
    An OpenDSU  BasicDB is a simple noSQL database
    The DB is used with a concept of "table" and rows (records) that have multiple versions
    The support for multiple versions is offered by getVersions function and by automatically managing 2 fields in the records:
         - the "__version" field representing the height of the graph
         - the "__previousRecord" field pointing to the previous version of the record
         - the "__changeId" is unique id, is used to quickly determine the unique id of parent node/s for future conflict solving
         - the "__timestamp" is a timestamp, number of milliseconds elapsed since January 1, 1970 00:00:00 UTC.

    As you can see, nothing is ever really updated, even the deletion is done by marking the record with the field "deleted"
 */

const ObservableMixin = require("../../utils/ObservableMixin");
let bindAutoPendingFunctions = require("../../utils/BindAutoPendingFunctions").bindAutoPendingFunctions;

/*
const crypto = require("crypto"); TODO: if required use from pskcrypto to have a single and portable point in all code

function uid(bytes = 32) {
    // node
    if (process) {
        return crypto.randomBytes(bytes).toString('base64')
    }
    // browser
    else {
        if (!crypto || !crypto.getRandomValues) {
            throw new Error('crypto.getRandomValues not supported by the browser.')
        }
        return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes))))
    }
}  */


function BasicDB(storageStrategy, conflictSolvingStrategy, options) {
    let self = this;
    options = options || {events: false};
    ObservableMixin(this);

    const errorAPI = require("opendsu").loadAPI("error");

    storageStrategy.on("initialised", () => {
        this.finishInitialisation();
        this.dispatchEvent("initialised");
    });

    this.refresh = (callback) => {
        storageStrategy.refresh(callback);
    }

    this.getUniqueIdAsync = async () => {
        return await storageStrategy.getUniqueIdAsync();
    }

    this.getAllRecords = (tableName, callback) => {
        storageStrategy.getAllRecords(tableName, callback);
    }

    this.addIndex = function (tableName, fieldName, forceReindex, callback) {
        if (typeof tableName === "undefined" || tableName === "undefined") {
            return callback(Error(`Table name "undefined" is not allowed`));
        }

        if (typeof forceReindex === "function") {
            callback = forceReindex;
            forceReindex = false;
        }

        if (typeof forceReindex === "undefined") {
            forceReindex = false;
        }

        storageStrategy.addIndex(tableName, fieldName, forceReindex, callback);
    }
    /*
        Get the whole content of the table and asynchronously return an array with all the  records satisfying the condition tested by the filterFunction
     */
    this.filter = function (tableName, query, sort, limit, callback) {
        storageStrategy.filter(tableName, query, sort, limit, callback);
    };

    this.query = this.filter;

    this.getAllTableNames = function (callback) {
        storageStrategy.getAllTableNames(callback);
    }

    function getDefaultCallback(message, tableName, key) {
        return function (err) {
            if (err) {
                reportUserRelevantError(message + ` with errors in table ${tableName} for key ${key}`, err);
            } else {
                console.log(message, `in table ${tableName} for key ${key}`);
            }
        }
    }

    /*
      Insert a record, return an error if an record with thew same key already exists
    */
    this.insertRecord = function (tableName, key, record, callback) {
        callback = callback ? callback : getDefaultCallback("Inserting a record", tableName, key);
        if (typeof key === "undefined" || key === "undefined") {
            return callback(Error(`Primary key "undefined" is not allowed`));
        }
        if (typeof tableName === "undefined" || tableName === "undefined") {
            return callback(Error(`Table name "undefined" is not allowed`));
        }

        self.getRecord(tableName, key, function (err, res) {
            if (!err || res) {
                //newRecord = Object.assign(newRecord, {__version:-1});
                return callback(createOpenDSUErrorWrapper("Failed to insert over an existing record", new Error(errorAPI.DB_INSERT_EXISTING_RECORD_ERROR)));
            }
            const sharedDSUMetadata = {}
            sharedDSUMetadata.__version = record.__version || 0;
            sharedDSUMetadata.pk = key;
            //sharedDSUMetadata.__changeId = uid();
            sharedDSUMetadata.__timestamp = record.__timestamp || Date.now();
            storageStrategy.insertRecord(tableName, key, Object.assign(sharedDSUMetadata, record), (err, res) => {
                if (err) {
                    return callback(createOpenDSUErrorWrapper(`Failed to insert record with key ${key} in table ${tableName} `, err));
                }

                if (options.events) {
                    self.dispatchEvent("change", JSON.stringify({table: tableName, pk: key}));
                }
                callback(undefined, res);
            });
        });
    };


    /*
        Update a record, return an error if does not exists (does not do an insert)
     */
    this.updateRecord = function (tableName, key, newRecord, callback) {
        callback = callback ? callback : getDefaultCallback("Updating a record", tableName, key);
        if (typeof key === "undefined" || key === "undefined") {
            return callback(Error(`Primary key "undefined" is not allowed`));
        }
        if (typeof tableName === "undefined" || tableName === "undefined") {
            return callback(Error(`Table name "undefined" is not allowed`));
        }

        let currentRecord;

        function doVersionIncAndUpdate(currentRecord, callback) {
            newRecord.__version++;
            newRecord.__timestamp = Date.now();
            //newRecord.__changeId = uid();

            if (newRecord.__version == 0) {
                storageStrategy.insertRecord(tableName, key, newRecord, callback);
            } else {
                storageStrategy.updateRecord(tableName, key, currentRecord, newRecord, callback);
            }
        }

        self.getRecord(tableName, key, function (err, res) {
            if (err || !res) {
                //newRecord = Object.assign(newRecord, {__version:-1});
                return callback(createOpenDSUErrorWrapper("Failed to update a record that does not exist", err));
            }
            if (res) {
                currentRecord = res;
                newRecord.__version = currentRecord.__version;
                newRecord.pk = key;
            }
            doVersionIncAndUpdate(currentRecord, (err) => {
                if (err) {
                    return callback(createOpenDSUErrorWrapper(`Failed to update record with key ${key} in table ${tableName} `, err));
                }

                if (options.events) {
                    self.dispatchEvent("change", JSON.stringify({table: tableName, pk: key}));
                }
                callback(undefined, newRecord);
            });
        });
    }

    /*
        Get a single row from a table
     */
    this.getRecord = function (tableName, key, callback) {
        storageStrategy.getRecord(tableName, key, function (err, res) {
            if (err || res.__deleted) {
                return callback(createOpenDSUErrorWrapper(`Missing record in table ${tableName} and key ${key}`, err));
            }
            callback(undefined, res);
        });
    };

    /*
      Get the history of a record, including the deleted versions
   */
    this.getHistory = function (tableName, key, callback) {
        storageStrategy.getRecord(tableName, key, function (err, res) {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`No history for table ${tableName} and key ${key}`, err));
            }
            callback(undefined, self.getRecordVersions(res));
        });
    };

    /*
      Delete a record
     */
    this.deleteRecord = function (tableName, key, callback) {
        self.getRecord(tableName, key, function (err, oldRecord) {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Could not retrieve record with key ${key} does not exist ${tableName} `, err));
            }

            const newRecord = JSON.parse(JSON.stringify(oldRecord));
            newRecord.__version++;
            newRecord.__timestamp = Date.now();
            newRecord.__deleted = true;
            storageStrategy.updateRecord(tableName, key, oldRecord, newRecord, (err) => {
                if (err) {
                    return callback(createOpenDSUErrorWrapper(`Failed to update with key ${key} in table ${tableName} `, err));
                }

                if (options.events) {
                    self.dispatchEvent("change", JSON.stringify({table: tableName, pk: key}));
                }
                callback();
            });
        })
    };

    this.getRecordVersions = function (record) {
        let arrRes = []
        while (record) {
            arrRes.unshift(record);
            record = record.__previousRecord;
        }
        return arrRes;
    }

    this.getIndexedFields = function (tableName, callback) {
        storageStrategy.getIndexedFields(tableName, callback);
    }

    this.writeKey = function (key, value, callback) {
        storageStrategy.writeKey(key, value, callback);
    };

    this.readKey = function (key, callback) {
        storageStrategy.readKey(key, callback);
    }
    this.beginBatch = () => {
        storageStrategy.beginBatch()
    }

    this.safeBeginBatch = (...args) => {
        storageStrategy.safeBeginBatch(...args);
    }

    this.safeBeginBatchAsync = async (...args) => {
        return await storageStrategy.safeBeginBatchAsync(...args);
    }

    this.startOrAttachBatch = (...args) => {
        storageStrategy.startOrAttachBatch(...args);
    }

    this.startOrAttachBatchAsync = async (...args) => {
        return await storageStrategy.startOrAttachBatchAsync(...args);
    }

    this.cancelBatch = (...args) => {
        storageStrategy.cancelBatch(...args);
    }

    this.cancelBatchAsync = async (...args) => {
        return await storageStrategy.cancelBatchAsync(...args);
    }

    this.commitBatch = (...args) => {
        storageStrategy.commitBatch(...args);
    }

    this.commitBatchAsync = async (...args) => {
        return await storageStrategy.commitBatchAsync(...args);
    }

    this.onCommitBatch = (...args) => {
        storageStrategy.onCommitBatch(...args);
    }

    this.batchInProgress = () => {
        return storageStrategy.batchInProgress();
    }

    bindAutoPendingFunctions(this, ["on", "off", "dispatchEvent", "batchInProgress"]);
    //============================================================
    // To not add others property on this object below this call =
    //============================================================
}

module.exports = BasicDB;
