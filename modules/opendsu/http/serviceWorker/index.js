function generateMethodForRequestWithData(httpMethod) {
    return function (url, data, options, callback) {
        if (typeof options === "function") {
            callback = options;
            options = {};
        }
        const headers = options.headers || {};
        if (ArrayBuffer.isView(data) || data instanceof ArrayBuffer) {
            headers['Content-Type'] = 'application/octet-stream';

            /**
             * Content-Length is an unsafe header and we cannot set it.
             * When browser is making a request that is intercepted by a service worker,
             * the Content-Length header is not set implicitly.
             */
            headers['X-Content-Length'] = data.byteLength;
        }

        fetch(url, {
            method: httpMethod,
            mode: 'cors',
            headers,
            body: data
        }).then(function (response) {
            if (response.status >= 400) {
                throw new Error(`An error occurred ${response.statusText}`);
            }
            return response.text().catch(() => {
                // This happens when the response is empty
                let emptyResponse = {message: ""}
                return JSON.stringify(emptyResponse);
            });
        }).then(function (data) {
            callback(null, data)
        }).catch(error => {
            callback(error);
        });
    };
}

module.exports = {
    fetch: fetch,
    doPost: generateMethodForRequestWithData('POST'),
    doPut: generateMethodForRequestWithData('PUT'),
    doGet: require("./../browser").doGet
}
