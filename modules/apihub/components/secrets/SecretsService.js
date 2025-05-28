const fs = require("fs");
const path = require("path");
const config = require("../../http-wrapper/config");
const {DBService} = require("../../../loki-enclave-facade/services/DBService");
const {CONTAINERS} = require("./constants");
const {Lock} = require("../../middlewares/SimpleLock/Lock")

function SecretsService(serverRootFolder) {
    const lock = new Lock()
    const DB_NAME= "db_secrets";
    const DEFAULT_CONTAINER_NAME = "default";
    const API_KEY_CONTAINER_NAME = "apiKeys";
    const getStorageFolderPath = () => {
        return DB_NAME;
        //return path.join(serverRootFolder, config.getConfig("externalStorage"), "secrets");
    }

    console.log("Secrets Service initialized");
    const logger = $$.getLogger("secrets", "apihub/secrets");
    const openDSU = require("opendsu");
    const crypto = openDSU.loadAPI("crypto");
    const encryptionKeys = process.env.SSO_SECRETS_ENCRYPTION_KEY ? process.env.SSO_SECRETS_ENCRYPTION_KEY.split(",") : undefined;
    let readonlyMode;

    // CouchDB integration

    const dbConfig = config.getConfig("db");

    const userName = process.env.DB_USER || dbConfig.user;
    const secret = process.env.DB_SECRET || dbConfig.secret;

    const dbServiceConfig = {
        uri: dbConfig.uri,
        username: userName,
        secret: secret,
        debug: dbConfig.debug || false,
        readonlyMode: process.env.READ_ONLY_MODE || false
    }

    logger.info(`Secrets Service connecting to DB in ${dbServiceConfig.readonlyMode ? "readonly mode" : ""}${dbServiceConfig.debug ? " and debug" : ""}`);

    const dbService = new DBService(dbServiceConfig);

    let writeEncryptionKey = encryptionKeys ? encryptionKeys[0].trim() : undefined;
    if (typeof writeEncryptionKey === "undefined") {
        readonlyMode = true;
        console.warn("No encryption key found. Readonly mode activated");
        return;
    }
    writeEncryptionKey = $$.Buffer.from(writeEncryptionKey, "base64");

    let previousEncryptionKey = encryptionKeys.length === 2 ? encryptionKeys[1].trim() : undefined;
    if (typeof previousEncryptionKey !== "undefined") {
        previousEncryptionKey = $$.Buffer.from(previousEncryptionKey, "base64");
    }
    const containers = {};

    const apiKeyExists = (apiKeysContainer, apiKey) => {
        const apiKeys = Object.values(apiKeysContainer);
        if (apiKeys.length === 0) {
            return false;
        }

        let index = apiKeys.findIndex(el => {
            if (typeof el === "string") {
                return el === apiKey;
            }
            return el.secret === apiKey;
        });
        return index !== -1;
    }

    const loadContainerAsync = async (containerName) => {
        try {
            containers[containerName] = await getDecryptedSecretsAsync(containerName);
            console.info("Secrets container", containerName, "loaded");
        } catch (e) {
            containers[containerName] = {};
            console.info("Initializing secrets container", containerName);
        }

        if (containerName === API_KEY_CONTAINER_NAME) {
            const apiKey = require("opendsu").loadAPI("crypto").sha256JOSE(process.env.SSO_SECRETS_ENCRYPTION_KEY, "base64");
            if (!apiKeyExists(containers[containerName], apiKey)) {
                console.log("API Key not found in container", containerName);
                containers[containerName][apiKey] = apiKey;
                await writeSecretsAsync(containerName);
            }
        }
    }

    this.listDBEntries = async () => {
        let db = dbService.client.use(DB_NAME);
        const result = await db.find({
            selector: {},
            limit: 100,
            skip: 0
        });
        return result.docs;
    }

    this.loadAsync = async () => {
        await ensureFolderExists(getStorageFolderPath());
        let secretsContainersNames = await this.listDBEntries();  //await dbService.listDocuments(DB_NAME);
        if (secretsContainersNames.length) {
            secretsContainersNames = secretsContainersNames.map((containerName) => {
                const extIndex = containerName._id.lastIndexOf(".");
                return path.basename(containerName._id).substring(0, extIndex);
            })

            for (let containerName of secretsContainersNames) {
                await loadContainerAsync(containerName);
            }
        } else {
            logger.info("No secrets containers found");
        }
    }

    const createError = (code, message) => {
        const err = Error(message);
        err.code = code

        return err;
    }

    const encryptSecret = (secret) => {
        return crypto.encrypt(secret, writeEncryptionKey);
    }

    const writeSecrets = async (secretsContainerName) => {
        if (readonlyMode) {
            throw createError(555, `Secrets Service is in readonly mode`);
        }
        let secrets = containers[secretsContainerName];
        secrets = JSON.stringify(secrets);
        let encryptedSecrets = encryptSecret(secrets);
        encryptedSecrets = ArrayBuffertoBase64(encryptedSecrets)

        let result;
        try {
            result = await dbService.insertDocument(DB_NAME, getSecretFilePath(secretsContainerName), {value: encryptedSecrets});
        } catch (e) {
            if (!e.message.includes(`already exists in ${DB_NAME}`))
                throw e
            result = await dbService.updateDocument(DB_NAME, getSecretFilePath(secretsContainerName), {value: encryptedSecrets})
        }
        return result;

        // fs.writeFile(getSecretFilePath(secretsContainerName), encryptedSecrets, callback);
    }

    const writeSecretsAsync = async (secretsContainerName) => {
        return writeSecrets(secretsContainerName);
    }
    const ensureFolderExists = async (folderPath) => {
        try {
            let db = await dbService.dbExists(folderPath)
            if(!db)
                throw new Error(`Database doesn't exist: ${folderPath}!`);
            // fs.accessSync(folderPath);
        } catch (e) {
            logger.debug(`Creating database ${folderPath}...`);
            await dbService.createDatabase(folderPath);
            // fs.mkdirSync(folderPath, {recursive: true});
        }
    }

    this.createDatabase = async (db) => {
        return ensureFolderExists(db)
    }

    function ArrayBuffertoBase64(buffer){
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }

        const value = btoa(binary);   
        return value
    }

    function Base64toArrayBuffer(str){
        const binaryString = atob(str); // Decode Base64 to binary string
        const len = binaryString.length;
        const bytes = new Uint8Array(len); // Create a Uint8Array
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i); // Convert binary string to byte array
        }
        const buff = bytes.buffer; // Return as ArrayBuffer  
        return Buffer.from(buff);
    }


    const getSecretFilePath = (secretsContainerName) => {
        const folderPath = getStorageFolderPath();
        // return path.join(folderPath, `${secretsContainerName}.secret`);
        return `${secretsContainerName}.secret`
    }

    const decryptAndParseSecrets = (secretsContainerName, encryptedSecret, encryptionKey) => {
        let decryptedSecrets;
        try {
            decryptedSecrets = crypto.decrypt(encryptedSecret, encryptionKey);
            decryptedSecrets = JSON.parse(decryptedSecrets.toString());
            containers[secretsContainerName] = decryptedSecrets;
            return decryptedSecrets;
        } catch (e) {
            logger.error(`Failed to parse secrets`);
            logger.debug(`Encrypted secrets: ${encryptedSecret}, Encryption Key: ${encryptionKey}`);
            throw createError(555, `Failed to parse secrets`);
        }
    }
    const decryptSecret = async (secretsContainerName, encryptedSecret) => {
        let decryptedSecret;
        if(!!encryptedSecret.data)
            encryptedSecret = encryptedSecret.data;

        try {
            decryptedSecret = decryptAndParseSecrets(secretsContainerName, encryptedSecret, writeEncryptionKey);
            readonlyMode = false;
            return decryptedSecret;
        } catch (e) {
            try {
                decryptedSecret = decryptAndParseSecrets(secretsContainerName, encryptedSecret, previousEncryptionKey);
                logger.info(0x501, "Secrets Encryption Key rotation detected");
                await writeSecretsAsync(secretsContainerName);
                logger.info(0x501, `Re-encrypting Recovery Passphrases on disk completed`);
                readonlyMode = false;
                return decryptedSecret;
            } catch (e) {
                logger.error(`Failed to decrypt secrets`);
                readonlyMode = true;
                console.log("Readonly mode activated")
                logger.debug(`Encrypted key: ${writeEncryptionKey}`);
                throw createError(555, `Failed to decrypt secrets`);
            }
        }
    };

    const getDecryptedSecrets = async (secretsContainerName, callback) => {
        const filePath = getSecretFilePath(secretsContainerName);

        try {
            let record = await dbService.readDocument(DB_NAME, filePath)
            const secrets = Base64toArrayBuffer(record.value);

            if (!secrets) {
                logger.log(`No secret found for ${filePath}`);
                throw createError(404, `No secret found for ${secretsContainerName}`);
            }

            let decryptedSecrets;
            try {
                decryptedSecrets = await decryptSecret(secretsContainerName, secrets);
            } catch (e) {
                throw e;
            }

            return decryptedSecrets;
        } catch (e) {
                logger.log(`Failed to read secret ${filePath}`);
                throw createError(404, `Failed to read file ${filePath}: ${e}`);
        }
        

        // fs.readFile(filePath, async (err, secrets) => {
        //     if (err || !secrets) {
        //         logger.log(`Failed to read file ${filePath}`);
        //         return callback(createError(404, `Failed to read file ${filePath}`));
        //     }

        //     let decryptedSecrets;
        //     try {
        //         decryptedSecrets = await decryptSecret(secretsContainerName, secrets);
        //     } catch (e) {
        //         return callback(e);
        //     }

        //     callback(undefined, decryptedSecrets);
        // });
    }

    const getDecryptedSecretsAsync = async (secretsContainerName) => {
        return await getDecryptedSecrets(secretsContainerName);
    }

    this.putSecretAsync = async (secretsContainerName, secretName, secret, isAdmin) => {
        await lock.acquire();
        let res;
        try {
            await loadContainerAsync(secretsContainerName);
            if (!containers[secretsContainerName]) {
                containers[secretsContainerName] = {};
                console.info("Initializing secrets container", secretsContainerName)
            }
            if (typeof isAdmin !== "undefined") {
                containers[secretsContainerName][secretName] = {};
                containers[secretsContainerName][secretName].secret = secret;
                containers[secretsContainerName][secretName].isAdmin = isAdmin;
            } else {
                containers[secretsContainerName][secretName] = secret;
            }
            res = await writeSecretsAsync(secretsContainerName);
        } catch (e) {
            lock.release();
            throw e;
        }
        lock.release();
        return res;
    }

    this.putSecretInDefaultContainerAsync = async (secretName, secret) => {
        return await this.putSecretAsync(DEFAULT_CONTAINER_NAME, secretName, secret);
    }

    this.getSecretSync = (secretsContainerName, secretName) => {
        if (readonlyMode) {
            throw createError(555, `Secrets Service is in readonly mode`);
        }
        if (!containers[secretsContainerName]) {
            containers[secretsContainerName] = {};
            console.info("Initializing secrets container", secretsContainerName);
        }
        const secret = containers[secretsContainerName][secretName];
        if (!secret) {
            throw createError(404, `Secret ${secretName} not found`);
        }

        return secret;
    }

    this.readSecretSync = this.getSecretSync;

    this.getSecretFromDefaultContainerSync = (secretName) => {
        return this.getSecretSync(DEFAULT_CONTAINER_NAME, secretName);
    }

    this.readSecretFromDefaultContainerSync = this.getSecretFromDefaultContainerSync;

    this.generateAPIKeyAsync = async (keyId, isAdmin) => {
        const apiKey = crypto.generateRandom(32).toString("base64");
        await this.putSecretAsync(API_KEY_CONTAINER_NAME, keyId, apiKey, isAdmin);
        return apiKey;
    }

    this.deleteAPIKeyAsync = async (keyId) => {
        await this.deleteSecretAsync(API_KEY_CONTAINER_NAME, keyId);
    }

    this.containerIsEmpty = (secretsContainerName) => {
        return Object.keys(containers[secretsContainerName] || {}).length === 0;
    }

    this.apiKeysContainerIsEmpty = () => {
        return this.containerIsEmpty(API_KEY_CONTAINER_NAME);
    }

    this.validateAPIKey = async (apiKey) => {
        console.debug("Validating internal call");
        if(apiKey === process.env.SSO_SECRETS_ENCRYPTION_KEY){
            return true;
        }
        await loadContainerAsync(CONTAINERS.API_KEY_CONTAINER_NAME);
        const container = containers[API_KEY_CONTAINER_NAME];
        if (!container) {
            return false;
        }

        return apiKeyExists(container, apiKey);
    }

    this.isAdminAPIKey = (apiKey) => {
        const container = containers[API_KEY_CONTAINER_NAME];
        if (!container) {
            return false;
        }
        const apiKeyObjs = Object.values(container);
        if (apiKeyObjs.length === 0) {
            return false;
        }
        let index = apiKeyObjs.findIndex((obj) => {
            return obj.secret === apiKey && obj.isAdmin;
        });
        return index !== -1;
    }

    this.deleteSecretAsync = async (secretsContainerName, secretName) => {
        await lock.acquire();
        try {
            await loadContainerAsync(secretsContainerName);
            if (!containers[secretsContainerName]) {
                containers[secretsContainerName] = {};
                console.info("Initializing secrets container", secretsContainerName)
            }
            if (!containers[secretsContainerName][secretName]) {
                throw createError(404, `Secret ${secretName} not found`);
            }
            delete containers[secretsContainerName][secretName];
            await writeSecretsAsync(secretsContainerName);
        } catch (e) {
            lock.release();
            throw e;
        }
        lock.release();
    }
}

let secretsServiceInstance;
const getSecretsServiceInstanceAsync = async (serverRootFolder) => {
    if (!secretsServiceInstance) {
        secretsServiceInstance = new SecretsService(serverRootFolder);
        await secretsServiceInstance.loadAsync();
    }

    secretsServiceInstance.constants = require("./constants");
    return secretsServiceInstance;
}

const resetInstance = async (serverRootFolder) => {
    secretsServiceInstance = new SecretsService(serverRootFolder);
    await secretsServiceInstance.loadAsync();
    return secretsServiceInstance;
}

module.exports = {
    getSecretsServiceInstanceAsync,
    resetInstance
};
