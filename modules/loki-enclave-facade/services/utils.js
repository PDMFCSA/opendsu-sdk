const {DBKeys} = require("../utils/constants")

/**
 *
 * @param {{client: nano, config: config}} self
 * @param logger
 * @param {Function} method
 * @private
 */
function ensureAuth(self, logger, method){
    const name = method.name
    const original = self[name];
    self[name] = async function(...args){
        try {
            return await original.apply(this, args);
        } catch (e){
            if (e.statusCode === 401 || e['status-code'] === 401) {
                try {
                    console.debug(`Cookie expired - Re-authenticating with CouchDB server`);
                    await self.client.auth(self.config.username, self.config.secret);
                } catch (err){
                    throw new Error(`Failed to authenticate with CouchDB server to redo the ${name} operation. Error: ${err.message || err}. Original Error: ${e.message || e}`);
                }
                return await original.apply(self, args);
            }
            testErrorForShutdown(e, logger)
            throw e;
        }
    }.bind(self)
}


/**
 * Test is the error is worth shutting down the system for
 * @param {Error} error
 * @param logger
 * @returns {void}
 */
function testErrorForShutdown(error, logger){
    if (error.message.includes("ECONNREFUSED")){
        logger.error("Failed to connect to couchdb instance. Shutting down the system...");
        process.exit(1);
    }
}


let filterOperationsMap = {
    "!=": "$ne",
    "==": "$eq",
    ">": "$gt",
    ">=": "$gte",
    "<": "$lt",
    "<=": "$lte",
    "like": "$regex"
}

/**
 * @description Converts OpenDSU query syntax to Couchdb mango query
 * @param {string[]} conditions - The conditions to filter by
 * @param {[string, "asc" | "desc"]} sort - The sorting criteria.
 * @param {number} [limit] the query limit. defaults to 250
 *
 **/
function parseConditionsToDBQuery(conditions, sort, limit = 250) {
    const mQuery = {
        selector: {},
        limit: limit
    }

    if (sort){
        mQuery.sort = {[sort[0]]: sort[1]}
    }

    if (!conditions || conditions.length === 0 || conditions === "") {
        if (mQuery.sort) {
            mQuery.selector[sort[0]] = {"$gt": null};
        } else {
            mQuery.selector = {[DBKeys.PK]: {"$gt": null}};
        }
    } else {
        let isSortIncluded = false;
        conditions.forEach(condition => {
            // Update regex pattern to capture more complex patterns for LIKE
            const match = condition.match(/^(\w+)\s*(>=|<=|==|!=|<>|>|<|like)\s*(.*)$/i);
            if (!match) {
                throw new Error(`Invalid condition: ${condition}`);
            }

            const [, field, operator, value] = match;
            if (field === sort[0]) {
                isSortIncluded = true;
            }
            const couchOperator = filterOperationsMap[operator.toLowerCase()];

            let conditionObject = {};

            if (operator.toLowerCase() === 'like') {
                // Process LIKE condition, and allow complex regex patterns (no quotes required)
                conditionObject[field] = {[couchOperator]: new RegExp(value.trim(), 'i')}; // case-insensitive regex
            } else {

                // Process other operators, handling numeric and string cases
                const numericValue = /^[0-9]+$/.test(value) ? parseFloat(value) : value;
                conditionObject[field] = {
                    [couchOperator]: isNaN(numericValue) ? value.replace(/['"]/g, '').trim() : numericValue
                };
            }

            mQuery.selector[field] = conditionObject;
        });
        if (!isSortIncluded && mQuery.sort) {
            mQuery.selector[sort[0]] = {"$gt": null};
        }
    }

    mQuery.selector = {$and: mQuery.selector};

    return mQuery;
}


module.exports =  {
    parseConditionsToDBQuery,
    testErrorForShutdown,
    ensureAuth
}