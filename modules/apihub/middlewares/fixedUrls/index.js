const TAG_FIXED_URL_REQUEST = "fixedurlrequest";
const INTERVAL_TIME = 1 * 1000; //ms aka 1 sec
const DEFAULT_MAX_AGE = 10; //seconds aka 10 sec
const TASKS_TABLE = "tasks";
const HISTORY_TABLE = "history";
const DATABASE = "FixedUrls.db";

const enclaveAPI = require("opendsu").loadAPI("enclave");
const fsname = "fs";
const fs = require(fsname);
const pathname = "path";
const path = require(pathname);
const logger = $$.getLogger("FixedUrl", "apihub/logger");

module.exports = function (server) {

    function debug(...args){
        if (server.config.db.debug){
            logger.debug(...args);
        }
    }

    const workingDir = path.join(server.rootFolder, "external-volume", "fixed-urls");
    const storage = path.join(workingDir, "storage");
    const database = path.join(workingDir, "..", "lightDB", "FixedUrls.db", "database");
    let lightDBEnclaveClient = require("loki-enclave-facade").createCouchDBEnclaveFacadeInstance(database);
    // let lightDBEnclaveClient = enclaveAPI.initialiseLightDBEnclave(DATABASE);

    let watchedUrls = [];
    //we inject a helper function that can be called by different components or middleware to signal that their requests
    // can be watched by us
    server.allowFixedUrl = function (url) {
        if (!url) {
            throw new Error("Expected an Array of strings or single string representing url prefix");
        }
        if (Array.isArray(url)) {
            watchedUrls = watchedUrls.concat(url);
            return;
        }
        watchedUrls.push(url);
    }

    function ensureURLUniformity(req) {
        let base = "https://non.relevant.url.com";
        //we add the base to get a valid url
        let url = typeof req === "object" ? req.url : req;
        let converter = new URL(base + url);
        //we ensure that the searchParams are sorted
        converter.searchParams.sort();
        //we remove our artificial base
        let newString = converter.toString().replaceAll(base, "");
        return newString;
    }

    function respond(res, content, statusCode) {
        if (statusCode) {
            res.statusCode = statusCode;
            let code = 0x104;

            if(res.req.url.includes('leaflets'))
                code = 0x102;

            if(res.req.url.includes('metadata'))
                code = 0x106;

            logger.audit(code, `Responding to url ${res.req.url} with status code ${statusCode}`);
        } else {
            let code = 0x103;

            if(res.req.url.includes('leaflets'))
                code = 0x101;

            if(res.req.url.includes('metadata'))
                code = 0x105;

            logger.audit(code, `Successful serving url ${res.req.url}`);
            res.statusCode = 200;
        }
        const fixedURLExpiry = server.config.fixedURLExpiry || DEFAULT_MAX_AGE;
        res.setHeader("cache-control", `max-age=${fixedURLExpiry}`);
        res.write(content);
        res.end();
    }

    function getIdentifier(fixedUrl) {
        return Buffer.from(fixedUrl).toString("base64url");
    }

    const indexer = {
        getFileName: function (fixedUrl) {
            return path.join(storage, getIdentifier(fixedUrl));
        },
        persist: function (fixedUrl, content, callback) {
            logger.debug("Persisting url", fixedUrl);
            fs.writeFile(indexer.getFileName(fixedUrl), content, callback);
        },
        persistAsync: async function (fixedUrl, content) {
            return new Promise((resolve, reject) => {
                indexer.persist(fixedUrl, content, (err, ...args) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(...args);
                });
            })
        },
        get: function (fixedUrl, callback) {
            logger.debug("Reading url", fixedUrl);
            fs.readFile(indexer.getFileName(fixedUrl), callback);
        },
        clean: function (fixedUrl, callback) {
            logger.debug("Cleaning url", fixedUrl);
            fs.unlink(indexer.getFileName(fixedUrl), callback);
        },
        cleanAsync: function (fixedUrl) {
            return new Promise((resolve, reject) => {
                return indexer.clean(fixedUrl, (err, ...args) => {
                    if (err)
                        return reject(err);
                    resolve(...args);
                })
            })
        },
        getTimestamp: function (fixedUrl, callback) {
            logger.debug("Reading timestamp for", fixedUrl);
            fs.stat(indexer.getFileName(fixedUrl), {bigint: true}, (err, stats) => {
                if (err) {
                    return callback(err);
                }
                return callback(undefined, stats.mtimeMs);
            });
        }
    };

    function createBulkPK(urls){
        try {
            urls = Array.isArray(urls)? urls : [urls];
            let base = urls[0];
            let isObject = typeof base === 'object' && base !== null
    
            base = isObject ? base.url.split("?")[0] : base.split("?")[0];
    
            const langs = urls.map(url => (typeof url === 'object' && url !== null) ? new URLSearchParams(url.url.split("?")[1]).get("lang") : new URLSearchParams(url.split("?")[1]).get("lang"))
            let params = new URLSearchParams(isObject ? urls[0].url.split("?")[1] : urls[0].split("?")[1]);
    
    
            params.set("lang", [...new Set(langs)].sort().join("-"));
    
            return `${base}?${params.toString()}`;
        } catch (e) {
            throw e
        }

    }

    function remap(obj){
        return Object.keys(obj).reduce((acc, key) => {
            if (key.startsWith("__"))
                key = key.substring(2);
            acc[key] = obj[key];
            return acc;
        }, {})            }

    const taskRegistry = {
        inProgress: {},
        createModel: function (fixedUrl) {

            function map(url){
                if (typeof url == "string")
                    return {url: url, pk: getIdentifier(url)}
                return {url: url.url, pk: getIdentifier(url.url)};
            }

            if (!Array.isArray(fixedUrl))
                return map(fixedUrl);
            return fixedUrl.map(map);
        },
        register: async function (task, callback) {
            let newRecord = taskRegistry.createModel(task);
            // newRecord.__fallbackToInsert = true

            // if (!Array.isArray(newRecord)) { // legacy mode. used for single entries
            //     debug("Registering task in history table", JSON.stringify(newRecord));
            //     return lightDBEnclaveClient.updateRecord($$.SYSTEM_IDENTIFIER, HISTORY_TABLE, newRecord.pk, newRecord,  (err, result) => {
            //         if (err){
            //             debug("Error registering task in history table", err);
            //         }
            //         callback(err, result);
            //     });
            // }
            // bulk mode

            try {
                newRecord = Array.isArray(newRecord)? newRecord : [newRecord];
                const ids = newRecord.map(r => r.pk)
                await lightDBEnclaveClient.storageDB.updateMany(HISTORY_TABLE, ids, newRecord);
            } catch (e){
                debug("Error registering tasks in tasks table", e);
                return callback(e);
            }
            callback(undefined);
            // const gtin = new URL(task[0].url.searchParams.get("gtin"));
            // if (!gtin)
            //     return callback(new Error(`could not get gtin in url ${task[0].url}. Should be impossible`));
            //
            // taskRunner.schedule(`gtin == ${gtin}`, (err, results) => {
            //     if (err)
            //         return callback(err);
            //     callback(undefined, results)
            // })
        },
        add: function (task, callback) {
            let newRecord = taskRegistry.createModel(task);
            debug("Adding task to tasks table", JSON.stringify(newRecord));

            const pk = createBulkPK(task)
            lightDBEnclaveClient.getRecord($$.SYSTEM_IDENTIFIER, TASKS_TABLE, pk, function (err, record) {
                if (err || !record) {
                    newRecord =  Array.isArray(newRecord) ? newRecord.map(remap) : [newRecord].map(remap);
                    debug("Task not found in tasks table, adding it", JSON.stringify(newRecord));
                    return lightDBEnclaveClient.insertRecord($$.SYSTEM_IDENTIFIER, TASKS_TABLE, pk, newRecord, (insertError)=>{
                        //if we fail... could be that the task is ready register by another request due to concurrency
                        //we do another getRecord and if fails we return the original insert record error
                        if(insertError){
                            //we set the counter to 2 just in case there is a task with a counter value that we don't know,
                            // and we hope to have enough invalidation of the task to don't have garbage
                            newRecord.counter = 2;
                            newRecord.__fallbackToInsert = true;
                            debug("Failed to insert task in task table. trying to update", JSON.stringify(newRecord));
                            return lightDBEnclaveClient.updateRecord($$.SYSTEM_IDENTIFIER, TASKS_TABLE, pk, newRecord, err => {
                                if(err){
                                    debug("Failed to update task in task table", err);
                                    return callback(err);
                                }
                                debug("Task added to tasks table", JSON.stringify(newRecord));
                                callback(undefined);
                            });
                        }
                        debug("Task added to tasks table", JSON.stringify(newRecord));
                        callback(undefined);
                    });
                }
                if (!record.counter) {
                    record.counter = 0;
                }
                record.counter++;
                record.__fallbackToInsert = true;
                debug("Task already exists in tasks table, updating", JSON.stringify(record));
                return lightDBEnclaveClient.updateRecord($$.SYSTEM_IDENTIFIER, TASKS_TABLE, pk, record, callback);
            });
        },
        addAsync: async function (task) {
          return new Promise((resolve, reject) => {
              taskRegistry.add(task, err => {
                  if(err) return reject(err)
                  resolve()
              })
          })
        },
        remove: function (task, callback) {
            let pk, toBeRemoved;
            if (Array.isArray(task)) {
                toBeRemoved = taskRegistry.createModel(task);
                pk = createBulkPK(toBeRemoved);
            } else {
                pk = typeof task === "string" ? task : task.url;
                toBeRemoved = taskRegistry.createModel(pk);
            }

            debug("Checking existence of task from tasks table before deleting", JSON.stringify(toBeRemoved));
            lightDBEnclaveClient.getRecord($$.SYSTEM_IDENTIFIER, TASKS_TABLE, pk, function (err, record) {
                if (err || !record) {
                    debug("Task not found in tasks table, ignoring deletion", JSON.stringify(toBeRemoved));
                    return callback(undefined);
                }
                if (record.counter && record.counter > 1) {
                    record.counter = 1;
                    record.__fallbackToInsert = true;
                    debug("found record to delete from table tasks. updating instead", JSON.stringify(record));
                    return lightDBEnclaveClient.updateRecord($$.SYSTEM_IDENTIFIER, TASKS_TABLE, pk, record, callback);
                }

                debug("found record to delete from table tasks. updating instead", JSON.stringify(record));
                lightDBEnclaveClient.deleteRecord($$.SYSTEM_IDENTIFIER, TASKS_TABLE, pk, err => {
                    if (err) {
                        debug("Error deleting task from tasks table", err);
                        return callback(err);
                    }
                    const end = Date.now();
                    debug(`Task ${task.url} deleted from tasks table`);
                    callback(undefined);
                });
            });
        },
        getOneTask: function (callback) {
            debug("Getting one task from tasks table");
            lightDBEnclaveClient.getOneRecord($$.SYSTEM_IDENTIFIER, TASKS_TABLE, function (err, task, masterPk) {
                if (err) {
                    debug("Error getting task from tasks table", err);
                    return callback(err);
                }
                if (!task) {
                    debug("No tasks found in tasks table, waiting for new tasks");
                    return callback(undefined);
                }
                let url = task.url

                if (!task.url && typeof task === "object"){ // we received an array like object
                    url = masterPk
                }

                if (taskRegistry.inProgress[url]) {
                    logger.debug(`${url} is in progress.`);
                    //we already have this task in progress, we need to wait
                    return callback(undefined);
                }
                taskRegistry.markInProgress(url);
                const end = Date.now();
                debug(`Task ${url} picked for processing. Took ${end - task.timestamp}ms.`);
                callback(undefined, task, masterPk);
            });
        },
        isInProgress: function (task) {
            return !!taskRegistry.inProgress[task];
        },
        isScheduled: function (task, callback) {
            let tobeChecked = taskRegistry.createModel(task);
            debug("Checking existence of task from tasks table (isScheduled)", JSON.stringify(tobeChecked));
            lightDBEnclaveClient.getRecord($$.SYSTEM_IDENTIFIER, TASKS_TABLE, tobeChecked.pk, function (err, task) {
                if (err || !task) {
                    debug("Task not found in tasks table", JSON.stringify(tobeChecked));
                    return callback(undefined, undefined);
                }
                callback(undefined, task);
            });
        },
        markInProgress: function (task) {
            debug(`Marking task ${task} as in progress`);
            taskRegistry.inProgress[task] = true;
        },
        markAsDone: function (task, callback) {
            logger.debug(`Marking task ${task} as done`);
            taskRegistry.remove(task, (err) => {
                if(err)
                    return callback(err);
                taskRegistry.inProgress[task] = undefined;
                delete taskRegistry.inProgress[task];
                callback()
            })
        },
        markAsDoneAsync: async function (task) {
          return new Promise((resolve, reject) => {
              taskRegistry.markAsDone(task, (err) => {
                  if(err)
                    return reject(err);
                  resolve();
              });
            });
        },
        isKnown: function (task, callback) {
            let target = taskRegistry.createModel(task);
            debug("Checking existence of task from history table (isKnown)", JSON.stringify(target));
            lightDBEnclaveClient.getRecord($$.SYSTEM_IDENTIFIER, HISTORY_TABLE, target.pk, (err, known) => {
                if (err || !known) {
                    logger.debug(`Task ${target.pk} not found in history`);
                    return callback(err || new Error(`Task ${target.pk} not found in history`));
                }
                debug("Task found in history table", JSON.stringify(known));
                callback(undefined, known);
            });
        },
        schedule: function (criteria, callback) {
            if(server.readOnlyModeActive){
                return callback(new Error("FixedURL scheduling is not possible when server is in readOnly mode"));
            }
            debug("filtering history table to schedule task", JSON.stringify(criteria));
            lightDBEnclaveClient.filter($$.SYSTEM_IDENTIFIER, HISTORY_TABLE, criteria, function (err, records) {
                if (err) {
                    if (err.code === 404) {
                        debug("No tasks found in history table - table does not exist apparently");
                        return callback();
                    }
                    debug("Error filtering history table", err);
                    return callback(err);
                }
                taskRegistry.add(records, function (err) {
                    if (err) {
                        return callback(err);
                    }
                    callback();
                });
            });
        },
        cancel: function (criteria, callback) {
            debug("filtering history table to cancel task", JSON.stringify(criteria));
            lightDBEnclaveClient.filter($$.SYSTEM_IDENTIFIER, HISTORY_TABLE, criteria, async function (err, tasks) {
                if (err) {
                    if (err.code === 404) {
                        debug("No tasks found in history table - table does not exist apparently");
                        return callback();
                    }
                    debug("Error filtering history table", err);
                    return callback(err);
                }

                try {
                    let markAsDone = $$.promisify(taskRegistry.markAsDone);
                    let clean = $$.promisify(indexer.clean);
                    for (let task of tasks) {
                        let url = task.url;
                        //by marking it as done the task is removed from pending and lightDBEnclaveClient also
                        await markAsDone(url);
                        try {
                            await clean(url);
                        } catch (err) {
                            //we ignore any errors related to file not found...
                            if (err.code !== "ENOENT") {
                                throw err;
                            }
                        }
                    }
                } catch (err) {
                    debug("Error canceling tasks", err);
                    return callback(err);
                }
                debug("Tasks cancelled successfully");
                callback(undefined);
            });
        },
        status: function () {
            if(server.readOnlyModeActive){
                //preventing log noise in readOnly mode
                return ;
            }
            let inProgressCounter = Object.keys(taskRegistry.inProgress);
            logger.debug(`Number of tasks that are in progress: ${inProgressCounter.length ? inProgressCounter.length : 0}`);

            lightDBEnclaveClient.getAllRecords($$.SYSTEM_IDENTIFIER, TASKS_TABLE, (err, scheduledTasks) => {
                if (!err) {
                    logger.debug(`Number of scheduled tasks: ${scheduledTasks ? scheduledTasks.length : 0}`);
                }
            });
            lightDBEnclaveClient.getAllRecords($$.SYSTEM_IDENTIFIER, HISTORY_TABLE, (err, tasks) => {
                if (!err) {
                    logger.debug(`Number of fixed urls: ${tasks ? tasks.length : 0}`);
                }
            });
        },
        httpStatus: async function(req, res){
            let inProgressCounter = Object.keys(taskRegistry.inProgress);
            let status = {};
            try{
                status.inProgress = inProgressCounter.length ? inProgressCounter.length : 0;
                let scheduledTasks = await $$.promisify(lightDBEnclaveClient.getAllRecords)($$.SYSTEM_IDENTIFIER, TASKS_TABLE);
                status.scheduled = scheduledTasks ? scheduledTasks.length : 0;
                let tasks = await $$.promisify(lightDBEnclaveClient.getAllRecords)($$.SYSTEM_IDENTIFIER, HISTORY_TABLE);
                status.total = tasks ? tasks.length : 0;
            }catch(err){
                console.error(err);
                res.statusCode = 500;
                res.end(`Failed to generate status info`);
            }
            res.statusCode = 200;
            res.end(JSON.stringify(status));
        }
    };
    const taskRunner = {
        doItNow: async function (tasks, masterPk) {
            if (!Array.isArray(tasks)){
                tasks = [tasks]
            }
            let results = []
            let failures = []

            for (let task of tasks){
                logger.info("Executing task for url", task.url || task);
                const fixedUrl = task.url || task;
                //we need to do the request and save the result into the cache
                let urlBase = `http://127.0.0.1`;
                let url = urlBase;
                if (!fixedUrl.startsWith("/")) {
                    url += "/";
                }
                url += fixedUrl;

                //let's create an url object from our string
                let converter = new URL(url);
                //we inject the request identifier
                converter.searchParams.append(TAG_FIXED_URL_REQUEST, "true");
                //this new url will contain our flag that prevents resolving in our middleware
                url = converter.toString().replace(urlBase, "");

                //executing the request
                debug(`Executing task. making local request to ${url}`, JSON.stringify(task));


                try {
                    const result = await new Promise((resolve, reject) => {
                        server.makeLocalRequest("GET", url, "", {}, function (error, result) {
                            if (error) {
                                return reject(error);
                            }
                            resolve(result);
                        })
                    })
                    results.push({url: task.url, content: result});
                } catch (error) {
                    failures.push({url: task.url, error: error});
                }
            }

            const successes = new Promise(async (resolve) => {
                for (const result of results) {
                    if (!taskRegistry.isInProgress(masterPk || tasks.url)) {
                        logger.info("Looks that somebody canceled the task before we were able to resolve.");
                        //if somebody canceled the task before we finished the request we stop!
                        return resolve();
                    }

                    if (result.content) {
                        //let's resolve as fast as possible any pending request for the current task
                        taskRunner.resolvePendingReq(result.url, result.content);

                        if (!taskRegistry.isInProgress(masterPk || result.url)) {
                            logger.info("Looks that somebody canceled the task before we were able to resolve.");
                            //if somebody canceled the task before we finished the request we stop!
                            return;
                        }

                        debug(`Persisting ${result.url}`)
                        try {
                            await indexer.persistAsync(result.url, result.content)
                        } catch (e) {
                            logger.error("Not able to persist fixed url", result.url, e);
                        }
                        resolve();
                    } else {
                        taskRunner.resolvePendingReq(result.url, result.content, 204);
                    }
                    try {
                        await taskRegistry.markAsDoneAsync(result.url)
                    } catch (err) {
                        logger.warn("Failed to mark request as done in lightDBEnclaveClient", result, err);
                    }
                    resolve();
                }
            })
            const fails = new Promise(async (resolve) => {
                for (const failure of failures) {
                    const {url, error} = failure;
                    logger.error(`caught an error during fetching fixedUrl ${url}`, error.message, error.code, error);
                    if (error.httpCode && error.httpCode > 300) {
                        //missing data
                        taskRunner.resolvePendingReq(url, "", error.httpCode);
                        logger.debug("Cleaning url because of the resolving error", error);
                        try {
                            await indexer.cleanAsync(url);
                            await taskRegistry.markAsDoneAsync(url)
                        } catch (e) {
                            if (e.code !== "ENOENT")
                                logger.error("Failed to clean url", e);
                            else
                                logger.debug("Failed to remove a task that we weren't able to resolve", e);
                        }
                        //if failed we add the task back to the end of the queue...
                        setTimeout(async () => {
                            debug("Rescheduling the task", url);
                            try {
                                await taskRegistry.addAsync(url)
                            } catch (err) {
                                logger.log("Failed to reschedule the task", url, err.message, err.code, err);
                            }
                        }, 100);
                    }
                }
                resolve();
            })

            try {
                await successes;
                await fails;
            } catch (err) {
                logger.error("Failed to execute all tasks", err);
            }
            try {
                await taskRegistry.markAsDoneAsync(masterPk);
            } catch (e){
                logger.error(`Failed to mark task ${masterPk} as done`, e);
            }
            taskRunner.execute();
        },
        execute: function () {
            taskRegistry.getOneTask(function (err, task, masterPk) {
                if (err || !task) {
                    return;
                }

                taskRunner.doItNow(task, masterPk);
            })
        },
        pendingRequests: {},
        registerReq: function (url, req, res) {
            if (!taskRunner.pendingRequests[url]) {
                taskRunner.pendingRequests[url] = [];
            }
            taskRunner.pendingRequests[url].push({req, res});
        },
        resolvePendingReq: function (url, content, statusCode) {
            let pending = taskRunner.pendingRequests[url];
            if (!pending) {
                return;
            }
            while (pending.length > 0) {
                let delayed = pending.shift();
                try {
                    respond(delayed.res, content, statusCode);
                } catch (err) {
                    //we ignore any errors at this stage... timeouts, client aborts etc.
                }
            }
        },
        status: function () {
            if(server.readOnlyModeActive){
                //preventing log noise in readOnly mode
                return ;
            }
            let pendingReq = Object.keys(taskRunner.pendingRequests);
            let counter = 0;
            for (let pendingUrl of pendingReq) {
                if (taskRunner.pendingRequests[pendingUrl]) {
                    counter += taskRunner.pendingRequests[pendingUrl].length;
                }
            }

            logger.debug(`Number of requests that are in pending: ${counter}`);
            taskRegistry.status();
        }
    };

    if(!server.readOnlyModeActive){
        fs.mkdir(storage, {recursive: true}, (err) => {
            if (err) {
                logger.error("Failed to ensure folder structure due to", err);
            }
            lightDBEnclaveClient.createDatabase(undefined, DATABASE, (err) => {
                if (err) {
                    logger.debug("Failed to create database", err.message, err.code, err.rootCause);
                }

                lightDBEnclaveClient.hasWriteAccess($$.SYSTEM_IDENTIFIER, (err, hasAccess) => {
                    if (err) {
                        logger.error("Failed to check if we have write access", err.message, err.code, err.rootCause);
                    }

                    if (hasAccess) {
                        setInterval(taskRunner.execute, INTERVAL_TIME);
                        return;
                    }

                    lightDBEnclaveClient.grantWriteAccess($$.SYSTEM_IDENTIFIER, (err) => {
                        if (err) {
                            logger.error("Failed to grant write access to the enclave", err.message, err.code, err.rootCause);
                        }

                        lightDBEnclaveClient.createCollection($$.SYSTEM_IDENTIFIER, TASKS_TABLE, ["pk", "__timestamp", "url"], (err) => {
                            if (err) {
                                logger.error("Failed to create collection", err.message, err.code, err.rootCause);
                            }

                            lightDBEnclaveClient.createCollection($$.SYSTEM_IDENTIFIER, HISTORY_TABLE, ["pk", "__timestamp", "url"], (err) => {
                                if (err) {
                                    logger.error("Failed to create collection", err.message, err.code, err.rootCause);
                                }

                                setInterval(taskRunner.execute, INTERVAL_TIME);
                            });
                        });
                    })
                })
            })
        });
    }

    server.put("/registerFixedURLs", require("../../http-wrapper/utils/middlewares").bodyReaderMiddleware);
    server.put("/registerFixedURLs", function register(req, res, next) {
        if (!lightDBEnclaveClient) {
            return setTimeout(() => {
                register(req, res, next);
            }, 100);
        }
        let body = req.body;
        try {
            body = JSON.parse(body);
        } catch (err) {
            logger.log(err);
        }

        if (!Array.isArray(body)) {
            body = [body];
        }

        // function recursiveRegistry() {
        // if (body.length === 0) {
        //     res.statusCode = 200;
        //     res.end();
        //     return;
        // }
        let fixedUrls = body;
        taskRegistry.register(fixedUrls, function (err) {
            if (err) {
                console.error(err);
                res.statusCode = 500;
                return res.end(`Failed to register urls`);
            }
            res.statusCode = 200;
            res.end();
            // recursiveRegistry();
        });


        // recursiveRegistry();
    });

    server.put("/activateFixedURL", require("../../http-wrapper/utils/middlewares").bodyReaderMiddleware);
    server.put("/activateFixedURL", function activate(req, res, next) {
        if (!lightDBEnclaveClient) {
            return setTimeout(() => {
                activate(req, res, next);
            }, 100);
        }

        if(!Buffer.isBuffer(req.body)){
            res.statusCode = 403;
            return res.end();
        }

        taskRegistry.schedule(req.body.toString(), function (err) {
            if (err) {
                logger.error(err);
                res.statusCode = 500;
                return res.end(`Failed to schedule task`);
            }
            res.statusCode = 200;
            res.end();
        });
    });

    server.put("/deactivateFixedURL", require("../../http-wrapper/utils/middlewares").bodyReaderMiddleware);
    server.put("/deactivateFixedURL", function deactivate(req, res, next) {
        if (!lightDBEnclaveClient) {
            return setTimeout(() => {
                deactivate(req, res, next);
            }, 100);
        }

        if(!Buffer.isBuffer(req.body)){
            res.statusCode = 403;
            return res.end();
        }

        taskRegistry.cancel(req.body.toString(), function (err) {
            if (err) {
                logger.error(err);
                res.statusCode = 500;
                return res.end(`Failed to cancel task`);
            }
            res.statusCode = 200;
            res.end();
        });
    });

    function getTimestampHandler(req, res, next) {
        if (["HEAD", "GET"].indexOf(req.method) === -1) {
            //not our responsibility... for the moment we resolve only GET methods that have query params...
            return next();
        }
        let possibleFixedUrl = false;
        let url = req.url;

        if (req.method === "GET" && !url.startsWith("/mtime")) {
            //not our responsibility...
            return next();
        }

        if (req.method === "GET") {
            url = url.replace("/mtime", "");
        }

        for (let wUrl of watchedUrls) {
            if (url.startsWith(wUrl)) {
                possibleFixedUrl = true;
            }
        }

        if (!possibleFixedUrl) {
            //not our responsibility
            return next();
        }

        let fixedUrl = ensureURLUniformity(url);
        indexer.getTimestamp(fixedUrl, function (err, timestamp) {
            if (err) {
                //for any errors we try to invalidate any cache
                timestamp = Date.now() - 1000;
            }
            res.setHeader("ETag", timestamp);
            if (req.method === "GET") {
                res.write(timestamp.toString());
            }
            res.statusCode = 200;
            res.end();

        });
    }


    //register a middleware to intercept all the requests
    server.use("*", function (req, res, next) {

        if (req.method !== "GET") {
            //not our responsibility... for the moment we resolve only GET methods that have query params...
            return next();
        }

        let possibleFixedUrl = false;
        for (let url of watchedUrls) {
            if (req.url.startsWith(url)) {
                possibleFixedUrl = true;
            }
        }

        if (!possibleFixedUrl) {
            //not our responsibility
            return next();
        }


        if (req.query && req.query[TAG_FIXED_URL_REQUEST]) {
            //this TAG_FIXED_URL_REQUEST query param is set by our runner, and we should let this request to be executed
            return next();
        }

        //if we reached this line of code means that we need to do our "thing"
        let fixedUrl = ensureURLUniformity(req);
        if (taskRegistry.isInProgress(fixedUrl)) {
            //there is a task for it... let's wait
            return taskRunner.registerReq(fixedUrl, req, res);
        }

        function resolveURL() {
            taskRegistry.isScheduled(fixedUrl, (err, task) => {
                if (task) {
                    logger.debug(`There is a scheduled task for this ${fixedUrl}`);
                    taskRunner.registerReq(fixedUrl, req, res);
                    taskRegistry.markInProgress(fixedUrl);
                    taskRunner.doItNow(task);
                    return;
                }

                taskRegistry.isKnown(fixedUrl, (err, known) => {
                    if (known) {
                        //there is no task in progress for this url... let's test even more...
                        return indexer.get(fixedUrl, (err, content) => {
                            if (err) {
                                logger.warn(`Failed to load content for fixedUrl; highly improbable, check your configurations!`);
                                //no current task and no cache... let's move on to resolving the req
                                return next();
                            }
                            //known fixed url let's respond to the client
                            respond(res, content);
                        });
                    }
                    next();
                });
            });
        }

        taskRegistry.isKnown(fixedUrl, (err, known) => {
            //if reached this point it might be a fixed url that is not known yet, and it should get registered and scheduled for resolving...
            //this case could catch params combinations that are not captured...

            if(server.readOnlyModeActive){
                //this case of readOnlyModeActive needs to be handled carefully in order to prevent any writes possible
                if(known){
                    return indexer.get(fixedUrl, (err, content) => {
                        if (err) {
                            logger.warn(`Failed to load content for fixedUrl; This could happen when the task is not yet resolved by full container`);
                            //no current task and no cache... let's move on to resolving the req
                            return next();
                        }
                        //known fixed url let's respond to the client
                        respond(res, content);
                    });
                }else{
                    return next();
                }
            }

            if (!known) {
                return taskRegistry.register(fixedUrl, (err) => {
                    if (err) {
                        //this should not happen... but even if it happens we log and go on with the execution
                        console.error(err);
                    }
                    taskRegistry.add(fixedUrl, (err) => {
                        if (err) {
                            //this should not happen... but even if it happens we log and go on with the execution
                            console.error(err);
                        }
                        resolveURL();
                    });
                });
            }
            resolveURL();
        });
    });
    server.use("*", getTimestampHandler);
    server.get("/mtime/*", getTimestampHandler);
    server.get("/statusFixedURL", taskRegistry.httpStatus);
}