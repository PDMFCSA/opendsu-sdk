const KeySSIMixin = require("../KeySSIMixin");
const SSITypes = require("../SSITypes");
const cryptoRegistry = require("../../CryptoAlgorithms/CryptoAlgorithmsRegistry");

function SymmetricalEncryptionSSI(enclave, identifier) {
    if (typeof enclave === "string") {
        identifier = enclave;
        enclave = undefined;
    }
    KeySSIMixin(this, enclave);
    const self = this;
    if (typeof identifier !== "undefined") {
        self.autoLoad(identifier);
    }

    self.getTypeName = () => {
        return SSITypes.SYMMETRICAL_ENCRYPTION_SSI;
    };

    let load = self.load;
    self.load = function (subtype, dlDomain, encryptionKey, control, vn, hint) {
        if (typeof encryptionKey === "undefined") {
            encryptionKey = cryptoRegistry.getEncryptionKeyGenerationFunction(self)();
        }

        if ($$.Buffer.isBuffer(encryptionKey)) {
            encryptionKey = cryptoRegistry.getBase64EncodingFunction(self)(encryptionKey);
        }

        load(subtype, dlDomain, encryptionKey, '', vn, hint);
    }

    self.getEncryptionKey = function (callback) {
        const encryptionKey = cryptoRegistry.getBase64DecodingFunction(self)(self.getSpecificString());
        callback(undefined, encryptionKey);
    };

    self.derive = function () {
        throw Error("Not implemented");
    }
}

function createSymmetricalEncryptionSSI(enclave, identifier) {
    return new SymmetricalEncryptionSSI(enclave, identifier);
}

module.exports = {
    createSymmetricalEncryptionSSI
};
