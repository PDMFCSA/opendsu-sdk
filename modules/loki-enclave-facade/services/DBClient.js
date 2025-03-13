const {normalizeNumber, validateSort, buildSelector, DBKeys, pruneOpenDSUFields, remapObject} = require("../utils");
let logger;
const {OpenDSUKeys} = require("../utils/constants");
const {processInChunks} = require("../utils/chunk");
const {ensureAuth} = require("./utils");

async function addIndex(client, database, properties) {
    // database = this.changeDBNameToLowerCaseAndValidate(database);

    if (!properties || (Array.isArray(properties) && properties.length === 0)) {
        logger.info(`No indexes provided for table: ${database}. Skipping index creation.`);
        return false;
    }

    // if (!await this.dbExists(database))
    //     throw new Error(`Table "${database}" does not exist.`);

    properties = Array.isArray(properties) ? properties : [properties];
    for (let indexedProp of properties){
        let index = `${indexedProp}_index`;
        try {
            await client.use(database).createIndex({
                name: index,
                index: {
                    fields: [indexedProp]
                },
                type: "json" // default
            });

            logger.info(`Added index ${index} for table "${database}".`);

            const asc_index = `${index}_ascending`;
            await client.use(database).createIndex({
                name: asc_index,
                index: {
                    fields: [{[indexedProp]: "asc"}]
                },
                type: "json" // default
            });

            logger.info(`Added index ${asc_index} for table "${database}" with ${indexedProp} asc.`);

            const desc_index = `${index}_descending`;
            await client.use(database).createIndex({
                name: desc_index,
                index: {
                    fields: [{[indexedProp]: "desc"}]
                },
                type: "json" // default
            });

            logger.info(`Added index ${desc_index} for table "${database}" with ${indexedProp} desc.`);
        } catch (err) {
            throw new Error(`Could not add index ${index} on ${database}: ${err.message}`);
        }
    }
    return true;
}

/**
 *
 */
class DatabaseClient {
    constructor(client, dbName) {
        logger = $$.getLogger(`DatabaseClient -  ${dbName}`);
        this.dbName = dbName;
        this.client = client;

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


    /**
     * Retrieves the document count for a specific table
     *
     * @returns {Promise<number>} - A promise that resolves to the document count of the specified table.
     * @throws {Error} - Throws an error if retrieving the document count fails.
     */
    async countDocs() {
        try {
            const info = await this.connection.info();
            return info.doc_count || 0;
        } catch (error) {
            if (error.statusCode === 404) {
                logger.warn(`Database "${this.dbName}" does not exist. Unable to count documents.`);
                return 0;
            }
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
                throw e
            }
            try {

                const insert = {
                    ...pruneOpenDSUFields(document),
                    [DBKeys.PK]: _id,
                    [DBKeys.TIMESTAMP]: Date.now()
                };

                const {id} = await this.connection.insert(insert);
                return await this.readDocument(id);
            } catch (err) {
                throw err;
            }
        }

        throw new Error(`A record with PK "${_id}" already exists in ${this.dbName}`);
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
            if (error.statusCode !== 404)
                logger.error(`Failed to retrieve document ${_id} from database ${this.dbName}:`, error);
            throw error;
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

            const response = await this.connection.insert(update);
            return await this.readDocument(response.id);
        } catch (error) {
            if (error.statusCode === 404) {
                if (document[OpenDSUKeys.FALLBACK_INSERT]) { // used by fixedURL
                    delete document[OpenDSUKeys.FALLBACK_INSERT];
                    return this.insertDocument(_id, document);
                }
                throw new Error(`Failed to update document "${_id}" from "${this.dbName}": Not found.`);
            }
            throw new Error(`Failed to update document "${_id}" from "${this.dbName}": ${error}`);
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
            if (error.statusCode === 404)
                return {[OpenDSUKeys.PK]: _id};

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

            const response = await this.connection.list(queryOptions);
            return processInChunks(response.rows, 2, (row) => remapObject(row.doc));
        } catch (error) {
            throw new Error(`Error listing documents from database ${this.dbName}: ${error}`);
        }
    }

    /**
     * Filters documents from specified table.
     *
     * @async
     * @param {Array<string>} query - The query object to filter documents.
     * @param {Array<Object>} [sort=[]] - Sorting criteria for the results.
     * @param {number} [limit=undefined] - Maximum number of documents to return.
     * @param {number} [skip=0] - Number of documents to skip before returning results.
     * @returns {Promise<Array<Object>>}g.
     * @throws {Error} If there is an issue querying the database.
     */
    async filter(query, sort = [], limit = undefined, skip = 0) {
        limit = normalizeNumber(limit, 1, undefined);
        skip = normalizeNumber(skip, 0, 0);
        sort = validateSort(sort);

        const selector = buildSelector(query);
        const mangoQuery = {
            selector,
            // fields: [],
            sort,
            skip,
            ...(limit ? {limit} : {})
        };

        try {
            const result = await this.connection.find(mangoQuery);
            return processInChunks(result.docs, 2, (doc) => remapObject(doc));
        } catch (error) {
            // TODO - Needs improvement. temporary quick fix:
            if (error.error === "no_usable_index") {
                try {
                    await addIndex.call(this, this.client, this.dbName, sort[0]);
                } catch (e) {
                    throw new Error(`Failed to add index to table ${this.dbName}: ${error}`);
                }
                return this.filter(query, sort, limit, skip);
            }
            throw new Error(`Error filtering documents from table ${this.dbName}: ${error}`);
        }
    }
}


module.exports = {DatabaseClient};
