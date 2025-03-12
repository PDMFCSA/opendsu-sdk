const KeySSIMixin = require("../KeySSIMixin");
const SReadSSI = require("./SReadSSI");
const SSITypes = require("../SSITypes");
const cryptoRegistry = require("../../CryptoAlgorithms/CryptoAlgorithmsRegistry");
const SSIFamilies = require("../SSIFamilies");

function SeedSSI(enclave, identifier) {
    if (typeof enclave === "string") {
        identifier = enclave;
        enclave = undefined;
    }
    KeySSIMixin(this, enclave);
    const self = this;
    if (typeof identifier !== "undefined") {
        self.autoLoad(identifier);
    }

    self.getTypeName = function () {
        return SSITypes.SEED_SSI;
    }

    self.setCanSign(true);

    self.initialize = function (dlDomain, privateKey, control, vn, hint, callback) {
        if (typeof privateKey === "function") {
            callback = privateKey;
            privateKey = undefined;
        }
        if (typeof control === "function") {
            callback = control;
            control = undefined;
        }
        if (typeof vn === "function") {
            callback = vn;
            vn = 'v0';
        }
        if (typeof hint === "function") {
            callback = hint;
            hint = undefined;
        }

        if (!privateKey) {
            cryptoRegistry.getKeyPairGenerator(self)().generateKeyPair((err, publicKey, privateKey) => {
                if (err) {
                    return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed generate private/public key pair`, err));
                }
                privateKey = cryptoRegistry.getBase64EncodingFunction(self)(privateKey);
                self.load(SSITypes.SEED_SSI, dlDomain, privateKey, '', vn, hint);
                if (callback) {
                    callback(undefined, self);
                }
            });
        } else {
            privateKey = cryptoRegistry.getBase64EncodingFunction(self)(privateKey);
            self.load(SSITypes.SEED_SSI, dlDomain, privateKey, '', vn, hint);
            if (callback) {
                callback(undefined, self);
            }
        }
        self.initialize = function () {
            throw Error("KeySSI already initialized");
        }
    };

    self.deriveSync = () => {
        const sReadSSI = SReadSSI.createSReadSSI();
        const privateKey = self.getPrivateKey();
        const sreadSpecificString = cryptoRegistry.getHashFunction(self)(privateKey);
        const publicKey = cryptoRegistry.getDerivePublicKeyFunction(self)(privateKey, "raw");
        const controlString = cryptoRegistry.getBase64EncodingFunction(self)(publicKey);
        sReadSSI.load(SSITypes.SREAD_SSI, self.getDLDomain(), sreadSpecificString, controlString, self.getVn(), self.getHint());

        return sReadSSI;
    }

    self.derive = function (callback) {
        try {
            const sReadSSI = self.deriveSync();
            callback(undefined, sReadSSI);
        } catch (e) {
            return callback(e);
        }
    };

    self.getPrivateKey = function (format) {
        let validSpecificString = self.getSpecificString();
        if (validSpecificString === undefined) {
            throw Error("Operation requested on an invalid SeedSSI. Initialise first")
        }
        let privateKey = cryptoRegistry.getBase64DecodingFunction(self)(validSpecificString);
        if (format === "pem") {
            const pemKeys = cryptoRegistry.getKeyPairGenerator(self)().getPemKeys(privateKey, self.getPublicKey("raw"));
            privateKey = pemKeys.privateKey;
        }
        return privateKey;
    }

    self.sign = function (dataToSign, callback) {
        let signature;
        try {
            const privateKey = self.getPrivateKey();
            const sign = cryptoRegistry.getSignFunction(self);
            const encode = cryptoRegistry.getBase64EncodingFunction(self);
            signature = encode(sign(dataToSign, privateKey));
        } catch (e) {
            if (callback) {
                return callback(e);
            }
            throw e;
        }

        if (callback) {
            callback(undefined, signature);
        }

        return signature;
    }

    self.getPublicKey = function (format) {
        return cryptoRegistry.getDerivePublicKeyFunction(self)(self.getPrivateKey(), format);
    }

    self.getEncryptionKey = function (callback) {
        self.derive((err, derivedKeySSI) => {
            if (err) {
                return callback(err);
            }

            derivedKeySSI.getEncryptionKey(callback);
        });
    };

    self.getKeyPair = function () {
        const keyPair = {
            privateKey: self.getPrivateKey("pem"),
            publicKey: self.getPublicKey("pem")
        }

        return keyPair;
    }

    self.getFamilyName = () => {
        return SSIFamilies.SEED_SSI_FAMILY;
    }
}

function createSeedSSI(enclave, identifier) {
    return new SeedSSI(enclave, identifier);
}

module.exports = {
    createSeedSSI
};
