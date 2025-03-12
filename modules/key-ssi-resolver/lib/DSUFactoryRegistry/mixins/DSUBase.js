module.exports = function (archive) {
    archive.call = (functionName, ...args) => {
        if (args.length === 0) {
            throw Error('Missing arguments. Usage: call(functionName, [arg1, arg2 ...] callback)');
        }
        const callback = args.pop();
        if (typeof callback !== "function") {
            throw Error('Last argument is always a callback function. Usage: call(functionName, [arg1, arg2 ...] callback)');
        }

        let evaluatedAPICode;

        function doEval(apiCode) {
            const or = require("overwrite-require");

            switch ($$.environmentType) {
                case or.constants.BROWSER_ENVIRONMENT_TYPE:
                case or.constants.WEB_WORKER_ENVIRONMENT_TYPE:
                case or.constants.SERVICE_WORKER_ENVIRONMENT_TYPE:
                    apiCode = new TextDecoder("utf-8").decode(apiCode);
                    break;
                default:
                    apiCode = apiCode.toString();
            }
            apiCode = "let module = {exports: {}}\n" + apiCode + "\nmodule.exports";
            evaluatedAPICode = eval(apiCode);
        }

        function execute() {
            try {
                //before eval we need to convert from $$.Buffer/ArrayBuffer to String
                evaluatedAPICode[functionName].call(this, ...args, callback);
            } catch (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to  execute api.js code `, err));
            }
        }


        archive.readFile("/code/api.js", function (err, apiCode) {
            if (err) {
                archive.readFile("/app/api.js", function (err, apiCode) {
                    if (err) {
                        return callback(createOpenDSUErrorWrapper(`Failed to  read file api.js in /code or /app`, err));
                    } else {
                        doEval(apiCode);
                        execute();
                    }
                });
            } else {
                doEval(apiCode);
                execute();
            }
        });

    }
    return archive;
}
