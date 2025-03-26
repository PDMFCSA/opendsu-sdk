const {normalizeNumber, validateSort, buildSelector, DBKeys, pruneOpenDSUFields, remapObject} = require("../utils");
let logger;
const {OpenDSUKeys} = require("../utils/constants");
const {processInChunks} = require("../utils/chunk");
const {ensureAuth} = require("./utils");

/**
 *
 */
class DatabaseClient {
    constructor(client, dbName, debug) {
        logger = $$.getLogger(`DatabaseClient -  ${dbName}`);
        this.dbName = dbName;
        this.client = client;
        this._debug = debug;

        this.connection = this.client.use(dbName);
        [
            this.countDocs,
            this.insertDocument,
            this.readDocument,
            this.updateDocument,
            this.deleteDocument,
            this.listDocuments,
            this.filter,
        ].forEach((m) => ensureAuth(this, logger, m));
    }

    debug(...args){
        if (this._debug)
            logger.debug(...args);
    }


    /**
     * Retrieves the document count for a specific table
     *
     * @returns {Promise<number>} - A promise that resolves to the document count of the specified table.
     * @throws {Error} - Throws an error if retrieving the document count fails.
     */
    async countDocs() {
        try {
            // Get the total document count
            const { doc_count = 0 } = await this.connection.info();

            // Retrieve only design documents
            const result = await this.connection.list({ startkey: '_design/', inclusive_end: false });
            const designDocCount = result.rows.length;
            return doc_count - designDocCount;
        } catch (error) {
            if (error.statusCode === 404) {
                logger.warn(`Database "${this.dbName}" does not exist. Unable to count documents.`);
                return 0;
            }
            this.debug(`Failed to retrieve document count for database ${this.dbName}: ${error}`)
            throw new Error(`Failed to retrieve document count for database ${this.dbName}: ${error}`);
        }
    }

    /**
     * Inserts a document into a specified database.
     * @param {string} _id - The primary key for the record.
     * @param {Object} document - The document to insert.
     * @returns {Promise<{ [key: string]: any }>} - The inserted document.
     * @throws {Error} - Throws an error if any operation fails, including checking if the record exists or inserting the record.
     */
    async insertDocument(_id, document) {
        // TODO - Empty objects {} are not being validated.
        _id = _id.toString();
        try {
            const record = await this.readDocument( _id);
        } catch  (e) {
            if (e.statusCode !== 404) {
                this.debug(`Could not read PK "${_id}" from ${this.dbName}`, e)
                throw e
            }
            let id;
            try {

                const insert = {
                    ...pruneOpenDSUFields(document),
                    [DBKeys.PK]: _id,
                    [DBKeys.TIMESTAMP]: document[DBKeys.TIMESTAMP] || Date.now()
                };

                id = (await this.connection.insert(insert)).id;
            } catch (err) {
                this.debug(`A record with PK "${_id}" already exists in ${this.dbName}`)
                throw err;
            }
            try {
                return await this.readDocument(id);
            } catch (e) {
                this.debug(`Failed to read record with PK "${_id}"  in ${this.dbName} after inserting`, e)
                throw e;
            }
        }

        this.debug(`A record with PK "${_id}" already exists in ${this.dbName}`)
        throw new Error(`A record with PK "${_id}" already exists in ${this.dbName}`);
    }


    async insertMany(_ids, documents) {
        try {

            // const insert = {
            //     ...pruneOpenDSUFields(document),
            //     [DBKeys.PK]: _id,
            //     [DBKeys.TIMESTAMP]: document[DBKeys.TIMESTAMP] || Date.now()
            // };

            const docs = _ids.map((id, i) => {
                return {
                    ...pruneOpenDSUFields(documents[i]),
                    [DBKeys.PK]: id,
                    [DBKeys.TIMESTAMP]: documents[i][DBKeys.TIMESTAMP] || Date.now()
                };
            })

            const responses = await this.connection.bulk({ docs: docs });

            const failed = responses.filter((response) => {
                const {id, rev, error, reason} = response;
                return !!error;
            }).map(({id, error, reason}) => ({ id, error, reason }));
            if (failed.length) {
                throw new Error(`Failed to insert ${failed.length}/${documents.length} documents: ${failed.map(({ id, error, reason }) => `${id}: ${error} - ${reason}`).join('\n')}`);
            }
        } catch (err) {
            this.debug(`Failed to bulk insert: ${err}`)
            throw err;
        }
    }
    /**
     * Retrieves a document by its ID from the specified databse.
     * @param {string} _id - The ID of the document to retrieve.
     * @returns {Promise<{ pk: string, [key: string]: any }>} - The retrieved document.
     */
    async readDocument(_id) {
        try {
            _id = _id.toString();
            const document = await this.connection.get(_id);
            return remapObject(document);
        } catch (error) {
            if (error.statusCode === 404) {
                // Overwrite error response when the document is deleted.
                error.description = `document with id '${_id}' not found.`;
                error.message = `document with id '${_id}' not found.`;
                error.reason = "missing";
                this.debug(`Failed to retrieve document ${_id} from database ${this.dbName}:`, error);
            }
            throw error
        }
    }

    /**
     * Updates a record in the specified table.
     * If the record does not exist and the `fallbackInsert` flag is set to true, it will insert the record instead.
     *
     * @param {string} _id - The ID of the document to update.
     * @param {Object} document - The record data to update.
     * @returns {Promise<{ [key: string]: any }>} - The updated or inserted record.
     * @throws {Error} - If the operation fails.
     */
    async updateDocument(_id, document) {
        let response;
        try {
            _id = _id.toString();
            const dbRecord = await this.connection.get(_id);
            const _rev = dbRecord[DBKeys.REV];
            for (let prop in document) {
                dbRecord[prop] = document[prop];
            }

            const update = {
                ...pruneOpenDSUFields(dbRecord),
                [DBKeys.PK]: _id,
                [DBKeys.REV]: _rev,
                [DBKeys.TIMESTAMP]: Date.now()
            };

            response = await this.connection.insert(update);
        } catch (error) {
            if (error.statusCode === 404) {
                if (document[OpenDSUKeys.FALLBACK_INSERT]) { // used by fixedURL
                    delete document[OpenDSUKeys.FALLBACK_INSERT];
                    this.debug(`Falling back to inserting document "${_id}" from "${this.dbName}" after 404: ${error}`);
                    return this.insertDocument(_id, document);
                }
                this.debug(`Failed to retrieve document ${_id} from database ${this.dbName} after 404: ${error}`);
                throw new Error(`Failed to update document "${_id}" from "${this.dbName}": Not found.`);
            }
            this.debug(`Failed to update document "${_id}" from "${this.dbName}": ${error}`);
            throw new Error(`Failed to update document "${_id}" from "${this.dbName}": ${error}`);
        }

        try {
            return await this.readDocument(response.id);
        } catch (e) {
            this.debug(`Failed to retrieve document ${_id} from database ${this.dbName} after updating`, e)
            throw e;
        }
    }

    async updateMany(_ids, documents) {
        try {

            // const insert = {
            //     ...pruneOpenDSUFields(document),
            //     [DBKeys.PK]: _id,
            //     [DBKeys.TIMESTAMP]: document[DBKeys.TIMESTAMP] || Date.now()
            // };


            const oldVersions = await this.connection.allDocs({ keys: _ids, include_docs: true });

            const docs = _ids.map((id, i) => {
                return {
                    ...pruneOpenDSUFields(documents[i]),
                    [DBKeys.PK]: id,
                    [DBKeys.REV]: oldVersions[i].doc._rev,
                    [DBKeys.TIMESTAMP]: documents[i][DBKeys.TIMESTAMP] || Date.now()
                };
            })

            const responses = await this.connection.bulk({ docs: docs });

            const failed = responses.filter((response) => {
                const {id, rev, error, reason} = response;
                return !!error;
            }).map(({id, error, reason}) => ({ id, error, reason }));
            if (failed.length) {
                throw new Error(`Failed to update ${failed.length}/${documents.length} documents: ${failed.map(({ id, error, reason }) => `${id}: ${error} - ${reason}`).join('\n')}`);
            }
        } catch (err) {
            this.debug(`Failed to bulk update: ${err}`)
            throw err;
        }
    }

    /**
     * Deletes a record from the specified table.
     * @param {string} _id - The primary key (ID) of the record to delete.
     * @returns {Promise<{ pk: string }>} - The deleted record.
     * @throws {Error} - If the operation fails.
     */
    async deleteDocument(_id) {
        try {
            _id = _id.toString();
            const document = await this.connection.get(_id);
            await this.connection.destroy(_id, document[DBKeys.REV]);
            return {[OpenDSUKeys.PK]: _id};
        } catch (error) {
            if (error.statusCode === 404){
                this.debug(`Document ${_id} not found in database ${this.dbName}. Skipping deletion.`);
                return {[OpenDSUKeys.PK]: _id};
            }

            this.debug(`Failed to delete document ${_id} from database ${this.dbName}: ${error}`);
            throw new Error(`Error deleting document ${_id} from table ${this.dbName}: ${error}`);
        }
    }

    /**
     * Lists documents from a specified table.
     *
     * @param {Object} [options={}] - Optional configuration object for listing documents.
     * @param {number} [options.limit] - The maximum number of documents to fetch (optional).
     * @returns {Promise<Array<{ [key: string]: any }>>} - A promise that resolves to an array of document objects.
     * @throws {Error} - Throws an error if the query fails.
     */
    async listDocuments(options = {}) {
        const {limit} = options;

        try {
            const queryOptions = {
                include_docs: true,
                startkey: '',
                endkey: '_design/',
                inclusive_end: false // Exclude design docs
            };

            if (limit && Number.isInteger(limit) && limit > 0)
                queryOptions.limit = limit;
            this.debug(`Listing documents from database ${this.dbName} with options: ${JSON.stringify(queryOptions)}`);
            const response = await this.connection.list(queryOptions);
            return processInChunks(response.rows, 2, (row) => remapObject(row.doc));
        } catch (error) {
            this.debug(`Failed to list documents from database ${this.dbName}: ${error}`);
            throw new Error(`Error listing documents from database ${this.dbName}: ${error}`);
        }
    }

    /**
     * Filters documents from specified table.
     *
     * @async
     * @param {Array<string>} query - The query object to filter documents.
     * @param {Array<Object>} sort - Sorting criteria for the results.
     * @param {number} [limit=undefined] - Maximum number of documents to return.
     * @param {number} [skip=0] - Number of documents to skip before returning results.
     * @returns {Promise<Array<Object>>}g.
     * @throws {Error} If there is an issue querying the database.
     */
    async filter(query, sort = [], limit = undefined, skip = 0) {
        limit = normalizeNumber(limit, 1, undefined);
        skip = normalizeNumber(skip, 0, 0);
        const _sort = validateSort(sort);

        const selector = buildSelector(query);
        const mangoQuery = {
            selector,
            // fields: [],
            sort: _sort,
            skip,
            ...(limit ? {limit} : {})
        };
        this.debug(`Filtering documents from database ${this.dbName} with options: ${JSON.stringify(mangoQuery)}`);
        const result = await this.connection.find(mangoQuery);
        return processInChunks(result.docs, 2, (doc) => remapObject(doc));
    }
}


module.exports = {DatabaseClient};
