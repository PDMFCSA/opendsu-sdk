/*
 require and $$.require are overwriting the node.js defaults in loading modules for increasing security, speed and making it work to the privatesky runtime build with browserify.
 The privatesky code for domains should work in node and browsers.
 */
function enableForEnvironment(envType) {

    const moduleConstants = require("./src/moduleConstants");

    /**
     * Used to provide autocomplete for $$ variables
     * @classdesc Interface for $$ object
     *
     * @name $$
     * @class
     *
     */

    switch (envType) {
        case moduleConstants.BROWSER_ENVIRONMENT_TYPE :
            global = window;
            break;
        case moduleConstants.WEB_WORKER_ENVIRONMENT_TYPE:
        case moduleConstants.SERVICE_WORKER_ENVIRONMENT_TYPE:
            global = self;
            break;
        default:
            Error.stackTraceLimit = Infinity;
    }

    if (typeof (global.$$) == "undefined") {
        /**
         * Used to provide autocomplete for $$ variables
         * @type {$$}
         */
        global.$$ = {};
    }

    if (typeof ($$.__global) == "undefined") {
        $$.__global = {};
    }

    if (typeof global.wprint === "undefined") {
        global.wprint = console.warn;
    }
    Object.defineProperty($$, "environmentType", {
        get: function () {
            return envType;
        },
        set: function (value) {
            throw Error(`Trying to set env value: ${value}. Environment type already set!`);
        }
    });


    if (typeof ($$.__global.requireLibrariesNames) == "undefined") {
        $$.__global.currentLibraryName = null;
        $$.__global.requireLibrariesNames = {};
    }


    if (typeof ($$.__runtimeModules) == "undefined") {
        $$.__runtimeModules = {};
    }


    if (typeof (global.functionUndefined) == "undefined") {
        global.functionUndefined = function () {
            console.log("Called of an undefined function!!!!");
            throw new Error("Called of an undefined function");
        };
    }

    const pastRequests = {};

    function preventRecursiveRequire(request) {
        if (pastRequests[request]) {
            const err = new Error("Preventing recursive require for " + request);
            err.type = "PSKIgnorableError";
            throw err;
        }

    }

    function disableRequire(request) {
        pastRequests[request] = true;
    }

    function enableRequire(request) {
        pastRequests[request] = false;
    }

    function requireFromCache(request) {
        return $$.__runtimeModules[request];
    }

    $$.__registerModule = function (name, module) {
        $$.__runtimeModules[name] = module;
    }

    function wrapStep(callbackName) {
        const callback = global[callbackName];

        if (callback === undefined) {
            return null;
        }

        if (callback === global.functionUndefined) {
            return null;
        }

        return function (request) {
            const result = callback(request);
            $$.__runtimeModules[request] = result;
            return result;
        }
    }


    function tryRequireSequence(originalRequire, request) {
        let arr;
        if (originalRequire) {
            arr = $$.__requireFunctionsChain.slice();
            arr.push(originalRequire);
        } else {
            arr = $$.__requireFunctionsChain;
        }

        preventRecursiveRequire(request);
        disableRequire(request);
        let result;
        const previousRequire = $$.__global.currentLibraryName;
        let previousRequireChanged = false;

        if (!previousRequire) {
            // console.log("Loading library for require", request);
            $$.__global.currentLibraryName = request;

            if (typeof $$.__global.requireLibrariesNames[request] == "undefined") {
                $$.__global.requireLibrariesNames[request] = {};
                //$$.__global.requireLibrariesDescriptions[request]   = {};
            }
            previousRequireChanged = true;
        }
        for (let i = 0; i < arr.length; i++) {
            const func = arr[i];
            try {

                if (func === global.functionUndefined) continue;
                result = func(request);

                if (result) {
                    break;
                }

            } catch (err) {
                if (err.type !== "PSKIgnorableError") {
                    if (err instanceof SyntaxError) {
                        console.error(err);
                    } else {
                        if (request === 'zeromq') {
                            console.warn("Failed to load module ", request, " with error:", err.message);
                        } else {
                            console.error("Failed to load module ", request, " with error:", err);
                        }
                    }
                    console.log("Require encountered an error while loading ", request, "\nCause:\n", err.stack);
                }
            }
        }

        if (!result) {
            throw Error(`Failed to load module ${request}`);
        }

        enableRequire(request);
        if (previousRequireChanged) {
            //console.log("End loading library for require", request, $$.__global.requireLibrariesNames[request]);
            $$.__global.currentLibraryName = null;
        }
        return result;
    }

    function makeBrowserRequire() {
        console.log("Defining global require in browser");


        global.require = function (request) {

            ///*[requireFromCache, wrapStep(webshimsRequire), , wrapStep(pskruntimeRequire), wrapStep(domainRequire)*]
            return tryRequireSequence(null, request);
        }
    }

    function makeIsolateRequire() {
        // require should be provided when code is loaded in browserify
        //const bundleRequire = require;

        $$.requireBundle('sandboxBase');
        // this should be set up by sandbox prior to
        const sandboxRequire = global.require;
        const cryptoModuleName = 'crypto';
        global.crypto = require(cryptoModuleName);
        const pathModuleName = 'path';
        const path = require(pathModuleName);

        function newLoader(request) {
            // console.log("newLoader:", request);
            //preventRecursiveRequire(request);
            const self = this;

            // console.log('trying to load ', request);

            function tryBundleRequire(...args) {
                //return $$.__originalRequire.apply(self,args);
                //return Module._load.apply(self,args)
                let res;
                try {
                    res = sandboxRequire.apply(self, args);
                } catch (err) {
                    if (err.code === "MODULE_NOT_FOUND") {
                        const p = path.join(process.cwd(), request);
                        res = sandboxRequire.apply(self, [p]);
                        request = p;
                    } else {
                        throw err;
                    }
                }
                return res;
            }

            let res;


            res = tryRequireSequence(tryBundleRequire, request);


            return res;
        }

        global.require = newLoader;
    }

    function makeNodeJSRequire() {
        const pathModuleName = 'path';
        const path = require(pathModuleName);
        const cryptoModuleName = 'crypto';
        const utilModuleName = 'util';
        $$.__runtimeModules["crypto"] = require(cryptoModuleName);
        $$.__runtimeModules["util"] = require(utilModuleName);

        const moduleModuleName = 'module';
        const Module = require(moduleModuleName);
        $$.__runtimeModules["module"] = Module;

        console.log("Redefining require for node");

        $$.__originalRequire = Module._load;
        const moduleOriginalRequire = Module.prototype.require;

        function newLoader(request) {
            // console.log("newLoader:", request);
            //preventRecursiveRequire(request);
            const self = this;

            function originalRequire(...args) {
                //return $$.__originalRequire.apply(self,args);
                //return Module._load.apply(self,args)
                let res;
                try {
                    res = moduleOriginalRequire.apply(self, args);
                } catch (err) {
                    if (err.code === "MODULE_NOT_FOUND") {
                        let pathOrName = request;
                        if (pathOrName.startsWith('/') || pathOrName.startsWith('./') || pathOrName.startsWith('../')) {
                            pathOrName = path.join(process.cwd(), request);
                        }
                        res = moduleOriginalRequire.call(self, pathOrName);
                        request = pathOrName;
                    } else {
                        throw err;
                    }
                }
                return res;
            }

            //[requireFromCache, wrapStep(pskruntimeRequire), wrapStep(domainRequire), originalRequire]
            return tryRequireSequence(originalRequire, request);
        }

        Module.prototype.require = newLoader;
        return newLoader;
    }

    require("./src/standardGlobalSymbols.js");

    if (typeof ($$.require) == "undefined") {

        $$.__requireList = ["webshimsRequire"];
        $$.__requireFunctionsChain = [];

        $$.requireBundle = function (name) {
            name += "Require";
            $$.__requireList.push(name);
            const arr = [requireFromCache];
            $$.__requireList.forEach(function (item) {
                const callback = wrapStep(item);
                if (callback) {
                    arr.push(callback);
                }
            });

            $$.__requireFunctionsChain = arr;
        };

        $$.requireBundle("init");

        switch ($$.environmentType) {
            case moduleConstants.BROWSER_ENVIRONMENT_TYPE:
                makeBrowserRequire();
                $$.require = require;
                let possibleRedirects = [301, 302];
                $$.httpUnknownResponseGlobalHandler = function (res) {
                    console.log("Global handler for unknown http errors was called", res.status, res);
                    if (res.status && possibleRedirects.indexOf(res.status) !== -1) {
                        window.location = "/";

                    }
                };
                break;
            case moduleConstants.WEB_WORKER_ENVIRONMENT_TYPE:
                makeBrowserRequire();
                $$.require = require;
                break;
            case moduleConstants.SERVICE_WORKER_ENVIRONMENT_TYPE:
                makeBrowserRequire();
                $$.require = require;
                break;
            case moduleConstants.ISOLATE_ENVIRONMENT_TYPE:
                makeIsolateRequire();
                $$.require = require;
                break;
            default:
                $$.require = makeNodeJSRequire();
        }

    }

    $$.promisify = function promisify(fn, instance) {
        const promisifiedFn = function (...args) {
            return new Promise((resolve, reject) => {
                if (instance) {
                    fn = fn.bind(instance);
                }
                fn(...args, (err, ...res) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(...res);
                    }
                });
            });
        };
        if (promisifiedFn.toString() === fn.toString()) {
            console.log("Function already promisified");
            return fn;
        }
        return promisifiedFn;
    };

    $$.callAsync = async function (func, ...args) {
        let error, result;
        try {
            result = await func(...args);
        } catch (err) {
            error = err
        }
        return [error, result];
    }

    $$.call = async function (func, ...args) {
        let asyncFunc = $$.promisify(func);
        return $$.callAsync(asyncFunc, ...args);
    }

    $$.makeSaneCallback = function makeSaneCallback(fn) {
        let alreadyCalled = false;
        let prevErr;
        if (fn.alreadyWrapped) {
            return fn;
        }

        const newFn = (err, res, ...args) => {
            if (alreadyCalled) {
                if (err) {
                    console.log('Sane callback error:', err);
                }

                throw new Error(`Callback called 2 times! Second call was stopped. Function code:\n${fn.toString()}\n` + (prevErr ? `Previous error stack ${prevErr.toString()}` : ''));
            }
            alreadyCalled = true;
            if (err) {
                prevErr = err;
            }
            return fn(err, res, ...args);
        };

        newFn.alreadyWrapped = true;
        return newFn;
    };

    function DebugHelper() {
        let debugEnabled = false;
        let debugEvents = [];
        let eventsStack = [];

        function getStackTrace() {
            return new Error().stack;
        }

        this.start = function () {
            debugEnabled = true;
        }

        this.resume = this.start;

        this.reset = function () {
            debugEnabled = true;
            debugEvents = [];
            eventsStack = [];
        }

        this.stop = function () {
            debugEnabled = false;
        }

        this.logDSUEvent = function (dsu, ...args) {
            if (!debugEnabled) return;

            let anchorID, dsuInstanceUID;
            try {
                anchorID = dsu.getAnchorIdSync();
                anchorID = anchorID.substring(4, 27) + "...";
            } catch (err) {
                anchorID = "N/A";
            }

            try {
                dsuInstanceUID = dsu.getInstanceUID();
            } catch (err) {
                dsuInstanceUID = "N/A";
            }
            this.log(`[${anchorID}][${dsuInstanceUID}]`, ...args);
        }

        this.log = function (...args) {
            console.debug(...args);
            if (!debugEnabled) return;
            debugEvents.push(`Log #${debugEvents.length}` + [...args].join(" "));
            eventsStack.push(getStackTrace());
        }

        this.logs = function () {
            console.log(`${debugEvents.length} events logged`);
            console.log(debugEvents.join("\n"));
        }

        this.context = function (eventNumber) {
            let realNumber = eventNumber;
            if (typeof eventNumber == "string") {
                eventNumber = eventNumber.slice(1);
                realNumber = parseInt(eventNumber);
            }
            return console.log(`Event ${debugEvents[eventNumber]}:\n`, eventsStack[realNumber], "\n");
        }

        const errorCodesForStdout = new Set();

        this.useStdoutOnceForErrorWithCode = function (code) {
            errorCodesForStdout.add(code);
        }

        this.useStderrForErrorWithCode = function (code) {
            if (errorCodesForStdout.has(code)) {
                errorCodesForStdout.delete(code);
            }
        }

        this.errorWithCodeShouldBeRedirectedToStdout = function (code) {
            if (errorCodesForStdout.has(code)) {
                return true;
            }

            return false;
        }

        let verbosityLevel;
        this.verbosity = function (level) {
            verbosityLevel = level;
        }

        this.getVerbosityLevel = function () {
            return verbosityLevel;
        }
    }

    $$.debug = new DebugHelper();
    $$.getLogger = require("./src/Logger").getLogger;
}


module.exports = {
    enableForEnvironment,
    constants: require("./src/moduleConstants")
};
