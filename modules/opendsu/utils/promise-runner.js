const arrayUtils = require("./array");
const {OpenDSUSafeCallback, createOpenDSUErrorWrapper} = require('./../error')

function validateMajorityRunAllWithSuccess(successResults, errorResults, totalCount) {
    const successCount = successResults.length;
    const errorCount = errorResults.length;

    if (totalCount == null) {
        // totalCount was not provided, so we consider to be the sum of the other results
        totalCount = successCount + errorCount;
    }

    const isMajorityWithSuccess = successCount >= Math.ceil(totalCount / 2);
    return isMajorityWithSuccess;
}

function runSinglePromise(executePromise, promiseInput) {
    return executePromise(promiseInput)
        .then((result) => {
            return {
                success: true,
                result,
            };
        })
        .catch((error) => {
            return {
                error,
            };
        });
}

async function runAll(listEntries, executeEntry, validateResults, callback, debugInfo) {
    if (typeof validateResults !== "function") {
        validateResults = validateMajorityRunAllWithSuccess;
    }

    const allInitialExecutions = listEntries.map((entry) => {
        return runSinglePromise(executeEntry, entry);
    });

    let results;

    try {
        results = await Promise.all(allInitialExecutions)
    } catch (e) {
        return callback(e);
    }

    const successExecutions = results.filter((run) => run.success);
    let errorExecutions = results.filter((run) => !run.success);
    errorExecutions = errorExecutions.map(e => {
        if (e.error && e.error.error) {
            return e.error.error;
        } else {
            return e;
        }
    });
    const isConsideredSuccessfulRun = validateResults(successExecutions, errorExecutions);
    if (isConsideredSuccessfulRun) {
        const successExecutionResults = successExecutions.map((run) => run.result);
        return callback(null, successExecutionResults);
    }

    let baseError = debugInfo;
    if (errorExecutions.length) {
        if (baseError) {
            baseError = OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper("Error found during runAll", errorExecutions[0], errorExecutions));
        }
    }
    return OpenDSUSafeCallback(callback)((createOpenDSUErrorWrapper("FAILED to runAll ", baseError)));
}

function runOneSuccessful(listEntries, executeEntry, callback, debugInfo) {
    if (!listEntries.length) {
        return callback("EMPTY_LIST");
    }

    let availableListEntries = [...listEntries];
    arrayUtils.shuffle(availableListEntries);

    const entry = availableListEntries.shift();

    const executeForSingleEntry = async (entry) => {
        let result;
        try {
            result = await executeEntry(entry);
        } catch (err) {
            if (!availableListEntries.length) {
                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to execute entry` + debugInfo, err));
            }

            const nextEntry = availableListEntries.shift();
            return executeForSingleEntry(nextEntry);
        }

        return callback(undefined, result);
    };

    executeForSingleEntry(entry);
}

async function runEnoughForMajority(listEntries, executeEntry, initialRunCount, validateResults, callback, debugInfo) {
    const totalCount = listEntries.length;

    if (!initialRunCount || typeof initialRunCount !== "number") {
        // no initiaRunCount was specified, so we execute half of them initially
        initialRunCount = Math.ceil(totalCount / 2);
    }
    initialRunCount = Math.min(initialRunCount, totalCount);

    if (typeof validateResults !== "function") {
        validateResults = validateMajorityRunAllWithSuccess;
    }

    let allExecutedRunResults = [];
    const initialEntries = listEntries.slice(0, initialRunCount);
    const remainingEntries = listEntries.slice(initialRunCount);

    const checkAllExecutedRunResults = async () => {
        const successExecutions = allExecutedRunResults.filter((run) => run.success);
        const errorExecutions = allExecutedRunResults.filter((run) => !run.success);

        const isConsideredSuccessfulRun = validateResults(successExecutions, errorExecutions, totalCount);
        if (isConsideredSuccessfulRun) {
            const successExecutionResults = successExecutions.map((run) => run.result);
            return callback(null, successExecutionResults);
        }

        if (!remainingEntries.length) {
            // the results weren't validated, but we don't have any other entry to run
            return callback(new Error("FAILED to run enough in majority" + debugInfo));
        }

        const nextEntry = remainingEntries.shift();

        const nextEntryResult = await runSinglePromise(executeEntry, nextEntry);
        allExecutedRunResults.push(nextEntryResult);
        checkAllExecutedRunResults();
    };

    const allInitialExecutions = initialEntries.map((entry) => {
        return runSinglePromise(executeEntry, entry);
    });

    try {
        allExecutedRunResults = await Promise.all(allInitialExecutions);
    } catch (e) {
        return callback(e);
    }
    checkAllExecutedRunResults();
}

module.exports = {
    runAll,
    runOneSuccessful,
    runEnoughForMajority,
};
