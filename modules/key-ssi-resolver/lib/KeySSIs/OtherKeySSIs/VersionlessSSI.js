const KeySSIMixin = require("../KeySSIMixin");
const SSITypes = require("../SSITypes");
const cryptoRegistry = require("../../CryptoAlgorithms/CryptoAlgorithmsRegistry");

function VersionlessSSI(enclave, identifier) {
    if (typeof enclave === "string") {
        identifier = enclave;
        enclave = undefined;
    }
    KeySSIMixin(this, enclave);
    const self = this;

    if (typeof identifier !== "undefined") {
        self.autoLoad(identifier);
    }

    const crypto = require("opendsu").loadApi("crypto");

    self.getTypeName = function () {
        return SSITypes.VERSIONLESS_SSI;
    };

    self.initialize = (dlDomain, filePath, encryptionKey, vn, hint) => {
        if (!encryptionKey) {
            encryptionKey = "";
        } else {
            encryptionKey = cryptoRegistry.getEncodingFunction(self)(encryptionKey);
        }
        self.load(SSITypes.VERSIONLESS_SSI, dlDomain, filePath, encryptionKey, vn, hint);
    };

    // required to overwrite in order to cache the DSU instance
    self.getAnchorId = function (plain, callback) {
        if (typeof plain === "function") {
            callback = plain;
        }
        // use hash in order to limit anchorId length
        const anchorId = crypto.sha256(self.getFilePath());

        if (!callback) {
            return anchorId;
        }
        callback(undefined, anchorId);
    };

    // required for opendsu resolver loader
    self.getHash = () => {
        return self.getAnchorId();
    };

    self.getFilePath = () => {
        return self.getSpecificString();
    };

    self.getEncryptionKey = () => {
        let encryptionKey = self.getControlString();
        if (encryptionKey) {
            try {
                encryptionKey = cryptoRegistry.getDecodingFunction(self)(self.getControlString());
            } catch (e) {
                return self.getControlString();
            }
            return encryptionKey;
        }
    };

    self.isEncrypted = () => {
        return !!self.getEncryptionKey();
    };

    self.encrypt = (data, callback) => {
        if (!self.isEncrypted()) {
            return callback(undefined, data);
        }

        try {
            const encryptionKey = self.getEncryptionKey();
            const result = crypto.encrypt(data, encryptionKey);
            callback(undefined, result);
        } catch (error) {
            callback(error);
        }
    };

    self.decrypt = (data, callback) => {
        if (!self.isEncrypted()) {
            return callback(undefined, data);
        }

        try {
            const encryptionKey = self.getEncryptionKey();
            const result = crypto.decrypt(data, encryptionKey);
            callback(undefined, result);
        } catch (error) {
            callback(error);
        }
    };
}

function createVersionlessSSI(enclave, identifier) {
    return new VersionlessSSI(enclave, identifier);
}

module.exports = {
    createVersionlessSSI,
};
