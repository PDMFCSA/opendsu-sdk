const KeySSIMixin = require("../KeySSIMixin");
const OReadSSI = require("./OReadSSI");
const SSITypes = require("../SSITypes");
const cryptoRegistry = require("../../CryptoAlgorithms/CryptoAlgorithmsRegistry");

function OwnershipSSI(identifier) {
    KeySSIMixin(this);
    const self = this;
    if (typeof identifier !== "undefined") {
        self.autoLoad(identifier);
    }

    self.getTypeName = function () {
        return SSITypes.OWNERSHIP_SSI;
    }

    self.setCanSign(true);

    self.initialize = function (dlDomain, privateKey, levelAndToken, vn, hint, callback) {
        if (typeof privateKey === "function") {
            callback = privateKey;
            privateKey = undefined;
        }
        if (typeof levelAndToken === "function") {
            callback = levelAndToken;
            levelAndToken = undefined;
        }
        if (typeof vn === "function") {
            callback = vn;
            vn = "v0";
        }
        if (typeof hint === "function") {
            callback = hint;
            hint = undefined;
        }

        if (typeof privateKey === "undefined") {
            cryptoRegistry
                .getKeyPairGenerator(self)()
                .generateKeyPair((err, publicKey, privateKey) => {
                    if (err) {
                        return OpenDSUSafeCallback(callback)(
                            createOpenDSUErrorWrapper(`Failed generate private/public key pair`, err)
                        );
                    }
                    privateKey = cryptoRegistry.getBase64EncodingFunction(self)(privateKey);
                    self.load(SSITypes.OWNERSHIP_SSI, dlDomain, privateKey, levelAndToken, vn, hint);
                    if (callback) {
                        callback(undefined, self);
                    }
                });
        } else {
            self.load(SSITypes.OWNERSHIP_SSI, dlDomain, privateKey, levelAndToken, vn, hint);
            if (callback) {
                callback(undefined, self);
            }
        }
        self.initialize = function () {
            throw Error("KeySSI already initialized");
        };
    };

    self.derive = function (callback) {
        const oReadSSI = OReadSSI.createOReadSSI();
        const privateKey = self.getPrivateKey();
        const publicKey = cryptoRegistry.getDerivePublicKeyFunction(self)(privateKey, "raw");
        const publicKeyHash = cryptoRegistry.getHashFunction(self)(publicKey);
        const levelAndToken = self.getControlString();

        const oReadSpecificString = cryptoRegistry.getHashFunction(self)(privateKey);
        const oReadControl = `${publicKeyHash}/${levelAndToken}`;
        oReadSSI.load(
            SSITypes.OWNERSHIP_READ_SSI,
            self.getDLDomain(),
            oReadSpecificString,
            oReadControl,
            self.getVn(),
            self.getHint()
        );
        callback(undefined, oReadSSI);
    };

    self.getPrivateKey = function (format) {
        let validSpecificString = self.getSpecificString();
        if (validSpecificString === undefined) {
            throw Error("Operation requested on an invalid OwnershipSSI. Initialise first");
        }
        let privateKey = validSpecificString;
        if (typeof privateKey === "string") {
            privateKey = cryptoRegistry.getBase64DecodingFunction(self)(privateKey);
        }
        if (format === "pem") {
            const pemKeys = cryptoRegistry.getKeyPairGenerator(self)().getPemKeys(privateKey, self.getPublicKey("raw"));
            privateKey = pemKeys.privateKey;
        }
        return privateKey;
    };

    self.sign = function (dataToSign, callback) {
        const privateKey = self.getPrivateKey();
        const sign = cryptoRegistry.getSignFunction(self);
        const encode = cryptoRegistry.getBase64EncodingFunction(self);
        const digitalProof = {};
        digitalProof.signature = encode(sign(dataToSign, privateKey));
        digitalProof.publicKey = encode(self.getPublicKey("raw"));

        callback(undefined, digitalProof);
    }


    self.getPrivateKeyHash = function () {
        return cryptoRegistry.getHashFunction(self)(self.getPrivateKey());
    };

    self.getPublicKey = function (format) {
        return cryptoRegistry.getDerivePublicKeyFunction(self)(self.getPrivateKey(), format);
    };

    self.getPublicKeyHash = function () {
        // const publicKey = cryptoRegistry.getDerivePublicKeyFunction(self)(self.getPrivateKey(), "raw");
        const publicKey = self.getPublicKey("raw");
        const publicKeyHash = cryptoRegistry.getHashFunction(self)(publicKey);
        return publicKeyHash;
    };

    self.getEncryptionKey = function (callback) {
        self.derive((err, derivedKeySSI) => {
            if (err) {
                return callback(err);
            }

            derivedKeySSI.getEncryptionKey(callback);
        });
    };

    const getControlParts = function () {
        let control = self.getControlString();
        if (control == null) {
            throw Error("Operation requested on an invalid OwnershipSSI. Initialise first");
        }
        return control.split("/");
    };

    self.getLevel = function () {
        let level = getControlParts()[0];
        return level;
    };

    self.getToken = function () {
        let token = getControlParts()[1];
        return token;
    };

    self.getAnchorId = function () {
        return self.getToken();
    };
}

function createOwnershipSSI(identifier) {
    return new OwnershipSSI(identifier);
}

module.exports = {
    createOwnershipSSI
};
