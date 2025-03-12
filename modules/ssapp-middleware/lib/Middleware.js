const EventResponse = require("./EventResponse").EventResponse;
const EventRequest = require("./EventRequest").EventRequest;

function Middleware() {
    let acceptedMethods = ["GET", "HEAD", "POST", "PUT", "DELETE", "CONNECT", "OPTIONS", "TRACE"];
    /*
    It's important to have the order of handlers from registry to ensure that a event is checked and pass
    to each handler in the correct order
     */
    let registeredHandlers = []; // an object of handlers


    /**
     * This function role is to properly extract the triplet ([path], [method], handler) from a given array.
     * When the array has only 2 elements (*string, *function), then, the triplet is considered as being ([path], "*", handler)
     * When a single array element is provided and its type is a function, then the triplet is considered as being ["*","*", handler], where
     * "*" means that path or method can be anything that is valid.
     * @param {Array} params
     * @returns {*[]}
     */

    this.requestedHosts = new Set();

    function unifyArguments(params) {
        let args = ["*", "*", undefined];
        switch (params.length) {
            case 0:
                throw new Error('Use method needs at least a handler argument.');
            case 1:
                if (typeof params[0] !== 'function') {
                    throw new Error('If only one argument is provided it must be a function');
                }
                args[2] = params[0];
                break;
            case 2:
                if (typeof params[0] !== "string" || typeof params[1] !== "function") {
                    throw new Error('If two arguments are provided the first one must be a string (url) and the second a function');
                }
                if (params[0][0] !== "/") {
                    throw new Error("First argument doesn't look like a path");
                }
                args[0] = params[0];
                args[2] = params[1];
                break;

            default:
                if (typeof params[0] !== 'string' || typeof params[1] !== 'string' || typeof params[2] !== 'function') {
                    throw new Error('If three or more arguments are provided the first one must be a path (url), the second one should be a HTTP verb and the third a function');
                }
                if (params[0] !== "*" && params[0][0] !== "/") {
                    throw new Error("First argument doesn't look like a path");
                }

                if (acceptedMethods.indexOf(params[1].toUpperCase()) === -1) {
                    throw new Error('Your second argument should be one HTTP verb. Supported HTTP verbs are ' + acceptedMethods);
                }
                args = params.slice(0, 3);
                break;

        }
        return args;
    }

    /**
     * This function responsibility is to find all registered handlers that can match the request (both, path and method)
     * @param requestPath
     * @param requestMethod
     * @returns {Array}
     */
    function findPathCandidates(requestPath, requestMethod) {

        let candidates = [];

        function checkMethod(method) {
            if (method === "*") {
                return true;
            }
            return method === requestMethod
        }

        /**
         * This function is receiving two arrays of path parts (e.g. a request path to "/api/node/dev" is
         * ["api","node","dev"] and a requestParts could be ["api",":type","*"]) and is returning an object
         * that is keeping the extracted params and a boolean that is indicating that those two arrays match.
         * Each handler's part is compared with the request part from the same position only if it is not declared
         * as a parameter or it is not "*".
         * @param handlerParts
         * @param requestParts
         * @returns {{params: {}, match: boolean}}
         */
        function checkMatch(handlerParts, requestParts) {
            let result = {
                params: {},
                match: true
            };
            if (handlerParts.length === 1 && handlerParts[0] === "*") {
                return result;
            }

            for (let i = 0; i < handlerParts.length; i++) {
                if (requestParts[i].length === 0) {
                    result.match = false;
                    break;
                }

                if (handlerParts[i].startsWith(":")) {
                    result.params[handlerParts[i].substring(1)] = requestParts[i];
                    continue;
                }
                if (handlerParts[i] === "*") {
                    continue;
                }

                if (handlerParts[i] !== requestParts[i]) {
                    result.match = false;
                    break;
                }

            }
            return result;
        }

        function extractPathParts(path) {
            let pathParts = path.split("/");

            if (pathParts.length > 1) {
                if (pathParts[0] === "") {
                    pathParts.shift();
                }
            }
            return pathParts;
        }

        let requestPathParts = extractPathParts(requestPath);

        for (let i = 0; i < registeredHandlers.length; i++) {
            let registeredHandler = registeredHandlers[i];
            let handlerPathParts = extractPathParts(registeredHandler.path);

            if (!checkMethod(registeredHandler.method)) {
                continue;
            }

            let matchResult = checkMatch(handlerPathParts, requestPathParts);
            if (matchResult.match) {
                candidates.push({params: matchResult.params, handler: registeredHandler.handler});
            }
        }

        return candidates;
    }

    /**
     * execute the request
     * @param request
     * @param response
     */
    this.executeRequest = function (request, response) {
        let method = request.method;
        let path = request.path;


        let requestHandlers = findPathCandidates(path, method);
        let index = 0;


        function executeNextHandler(request, response, index) {

            if (requestHandlers[index]) {

                if (requestHandlers[index].params) {
                    request.params = requestHandlers[index].params;
                }

                let nextHandler = requestHandlers[index].handler;
                if (typeof nextHandler === "function")
                    nextHandler(request, response, () => executeNextHandler(request, response, ++index));
            }
        }

        if (requestHandlers.length > 0) {
            executeNextHandler(request, response, index);
        }
    };

    /**
     * Registering handlers
     *
     *  use(handler);
     *  use(path, handler);
     *  use(path, method, handler);
     *
     * @param params
     */
    this.use = function (...params) {
        let args = unifyArguments(params);

        registeredHandlers.push({
            path: args[0],
            method: args[1],
            handler: args[2]
        });
    };

    /**
     * Forward requests to host network
     * Currently used in development
     */
    this.useDefault = function () {
        this.use((req, res) => {
            req.forward(res);
        });
    };

    /**
     * TODO delete this - was used for dev purposes
     * * @returns {Array}
     */
    this.listAllHandlers = function () {
        return registeredHandlers;
    };


    this.get = function (path, handler) {
        this.use(path, "GET", handler)
    };

    this.post = function (path, handler) {
        this.use(path, "POST", handler)
    };

    this.put = function (path, handler) {
        this.use(path, "PUT", handler)
    };

    this.delete = function (path, handler) {
        this.use(path, "DELETE", handler)
    };

    /**
     * Returns a promise that will resolve the request body depending on the received headers.
     * @param event
     * @returns {Promise<any>}
     */
    async function extractBody(event) {
        let body;
        let request = event.request.clone();
        let headers = request.headers;
        let contentType = "application/octet-stream";

        if (headers.has('Content-Type')) {
            contentType = headers.get('Content-Type');
        }

        let typeAndSubtype = contentType.split(";")[0];

        switch (typeAndSubtype) {
            case "text/plain":
                body = await request.text();
                break;
            case "application/json":
                body = await request.json();
                break;
            case "application/x-www-form-urlencoded":
                body = await request.formData();
                break;
            case "multipart/form-data":
                body = await request.formData();
                break;
            default:
                body = await request.arrayBuffer();
        }

        return body;

    }

    /**
     * Execute registered request handlers for a
     * FetchEvent
     *
     * @param {FetchEvent} event
     * @return {Promise}
     */
    this.handleEvent = (event) => {
        let requestedUrl = new URL(event.request.url);
        this.requestedHosts.add(requestedUrl.host);

        return extractBody(event).then((body) => {
            Object.defineProperty(event.request, "body", {value: body});
            //event.request.body = body;
            let request = new EventRequest(event);
            let response = new EventResponse(event);

            return new Promise((resolve) => {
                event.resolver = resolve;

                this.executeRequest(request, response);
            })
        })
    };
}

module.exports = Middleware;

