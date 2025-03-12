const http = require("http");
const https = require("https");
const URL = require("url");

function getProtocol(url, options) {
    let protocol;

    // const urlObject = new URL(url).catch((err) => { throw new Error(err) });
    // return urlObject.protocol === 'http:' ? http : https

    if (typeof options !== "undefined") {
        if (options.protocol === 'http') {
            protocol = http;
        } else if (options.protocol === 'https') {
            protocol = https;
        } else {
            if (url.startsWith("https:")) {
                protocol = https;
            } else if (url.startsWith("http:")) {
                protocol = http;
            }
        }
    } else {
        if (url.startsWith("https:")) {
            protocol = https;
        } else if (url.startsWith("http:")) {
            protocol = http;
        }
    }

    if (typeof protocol === "undefined") {
        throw new Error(`Unable to determine the protocol`);
    }

    return protocol;
}

function decipherUrl(url, options) {
    const innerUrl = URL.parse(url);

    options.hostname = innerUrl.hostname;
    options.path = innerUrl.pathname + (innerUrl.search || '');
    options.port = parseInt(innerUrl.port);
}

function fetch(url, options = {}) {
    const protocol = getProtocol(url, options);

    let promise = new Promise((resolve, reject) => {
        decipherUrl(url, options);

        let request = protocol.request(url, options, (response) => {
            resolve(new Response(request, response));
        });

        if (options.body) {
            let body = options.body;
            if (typeof body.pipe === 'function') {
                body.pipe(request);
            } else {
                if (typeof body !== 'string' && !$$.Buffer.isBuffer(body) && !ArrayBuffer.isView(body)) {
                    body = JSON.stringify(body);
                }

                request.write(body);
            }
        }

        request.on("error", (error) => {
            reject(error);
        });

        request.end();
    });

    return promise;
}

function Response(httpRequest, httpResponse) {
    let readingInProgress = false;

    function readResponse(callback) {
        if (readingInProgress) {
            throw new Error("Response reading in progress");
        }

        readingInProgress = true;

        //data collecting
        let rawData;
        const contentType = httpResponse.headers['content-type'];
        const isPartialContent = httpResponse.statusCode === 206;

        if (contentType === "application/octet-stream" || isPartialContent) {
            rawData = [];
        } else {
            rawData = '';
        }

        httpResponse.on('data', (chunk) => {
            if (Array.isArray(rawData)) {
                rawData.push(...chunk);
            } else {
                rawData += chunk;
            }
        });

        httpResponse.on('end', () => {
            try {
                if (Array.isArray(rawData)) {
                    rawData = $$.Buffer.from(rawData);
                }
                callback(undefined, rawData);
            } catch (err) {
                OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to process raw data`, err));
            } finally {
                //trying to prevent getting ECONNRESET error after getting our response
                httpRequest.abort();
            }
        });
    }

    this.ok = httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 ? true : false;
    this.status = httpResponse.statusCode;
    this.statusMessage = httpResponse.statusMessage;

    function Headers(headers) {
        headers = headers || {};

        this.get = (headerKey) => {
            return headers[headerKey];
        }
    }

    this.headers = new Headers(httpResponse.headers);

    this.arrayBuffer = function () {
        let promise = new Promise((resolve, reject) => {
            readResponse((err, responseBody) => {
                if (err) {
                    return reject(err);
                }
                //endure responseBody has the wright type of ArrayBuffer
                resolve(responseBody);
            });
        });
        return promise;
    }

    this.blob = function () {
        let promise = new Promise((resolve, reject) => {
            readResponse((err, responseBody) => {
                if (err) {
                    return reject(err);
                }
                resolve(responseBody);
            });
        });
        return promise;
    }

    this.text = function () {
        let promise = new Promise((resolve, reject) => {
            readResponse((err, responseBody) => {
                if (err) {
                    return reject(err);
                }
                resolve(responseBody);
            });
        });
        return promise;
    }

    this.formData = function () {
        let promise = new Promise((resolve, reject) => {
            readResponse((err, responseBody) => {
                if (err) {
                    return reject(err);
                }
                resolve(responseBody);
            });
        });
        return promise;
    }

    this.json = function () {
        let promise = new Promise((resolve, reject) => {
            readResponse((err, responseBody) => {
                if (err) {
                    return reject(err);
                }
                let jsonContent;
                try {
                    //do we really need this if ?!
                    if ($$.Buffer.isBuffer(responseBody)) {
                        responseBody = responseBody.toString();
                    }
                    jsonContent = responseBody ? JSON.parse(responseBody) : responseBody;
                } catch (e) {
                    return reject(e);
                }
                resolve(jsonContent);
            });
        });
        return promise;
    }

    return this;
}

module.exports = {
    fetch
}
