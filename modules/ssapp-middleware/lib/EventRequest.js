const unsupportedMethods = ["acceptsCharsets", "acceptsEncodings", "acceptsLanguages", "param", "is", "range"];
const unsupportedProperties = ["app", "fresh", "ip", "ips", "signedCookies", "stale", "subdomains", "xhr"];


/**
 * Extract query params from url
 * @param url
 */
function extractQueryParams(url) {

    let searchParams = url.searchParams;
    let queryParams = {};

    for (let pair of searchParams.entries()) {
        queryParams[pair[0]] = pair[1];
    }
    return queryParams;
}

function EventRequest(event) {

    this.body = {};

    if (event.request.body && event.request.body instanceof FormData) {
        for (let pair of event.request.body.entries()) {
            const key = pair[0];
            const value = pair[1];

            // Handle the "array[]" input format
            if (key.substr(-2) === '[]') {
                if (typeof this.body[key] === 'undefined') {
                    this.body[key] = [];
                }
            }

            if (Array.isArray(this.body[key])) {
                this.body[key].push(value);
                continue;
            }

            this.body[key] = value;
        }
    } else {
        this.body = event.request.body;
    }


    this.method = event.request.method;
    this.originalUrl = event.request.url;
    let url = new URL(this.originalUrl);
    this.path = url.pathname;
    this.hostname = url.hostname;
    this.protocol = url.protocol;
    this.params = {};
    this.query = extractQueryParams(url);
    this.secure = this.protocol === "https";

    let requestHeaders = {};

    for (let [header, value] of event.request.headers.entries()) {
        /**
         * Content-Length header is set to request when it is intercepted by service worker
         */
        if (header.toUpperCase() === "X-CONTENT-LENGTH") {
            header = "Content-Length";
        }
        requestHeaders[header] = value;
    }

    this.headers = requestHeaders;

    /**
     * Checks if the specified content types are acceptable, based on the request’s Accept HTTP header field.
     * The method returns the best match, or if none of the specified content types is acceptable, returns false
     * (in which case, the application should respond with 406 "Not Acceptable").
     * The type value may be a single MIME type string (such as “application/json”), an extension name such as “json”,
     * a comma-delimited list, or an array. For a list or array, the method returns the best match (if any).
     * @param types
     */
    this.accepts = function () {
        throw new Error("Unimplemented method!");
    };

    /**
     * Returns the specified HTTP request header field (case-insensitive match). The Referrer and Referer fields are interchangeable.
     * @param field
     */
    this.get = function (field) {
        let headerName = Object.keys(requestHeaders).find(headerName => {
            return headerName.toLowerCase() === field.toLowerCase();
        });

        return requestHeaders[headerName];
    };

    /**
     * Forward the request to the host network
     * @param {EventResponse} res
     * @return {Promise}
     */
    this.forward = function (res) {
        return fetch(event.request)
            .then((response) => {
                res.sendRaw(response);
            })
    };

    /**
     * Add handlers for unimplemented methods
     * TODO extract these and see also @EventResponse
     */
    unsupportedProperties.forEach(unsupportedProperty => {
        Object.defineProperty(this, unsupportedProperty, {
            get: function () {
                throw new Error("Property " + unsupportedProperty + " is not supported!")
            }
        })
    });

    unsupportedMethods.forEach(unsupportedMethod => {
        Object.defineProperty(this, unsupportedMethod, {
            get: function () {
                throw new Error("Method " + unsupportedMethod + " is not supported!")
            }
        })
    });
}

exports.EventRequest = EventRequest;
