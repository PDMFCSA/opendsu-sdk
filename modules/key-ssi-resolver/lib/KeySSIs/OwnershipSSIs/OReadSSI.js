const KeySSIMixin = require("../KeySSIMixin");
const ZATSSI = require("./ZATSSI");
const SSITypes = require("../SSITypes");
const cryptoRegistry = require("../../CryptoAlgorithms/CryptoAlgorithmsRegistry");

function OReadSSI(identifier) {
    KeySSIMixin(this);
    const self = this;

    if (typeof identifier !== "undefined") {
        self.autoLoad(identifier);
    }

    self.getTypeName = function () {
        return SSITypes.OWNERSHIP_READ_SSI;
    }

    self.initialize = (dlDomain, hashPrivateKey, hashPublicKeyLevelAndToken, vn, hint) => {
        self.load(SSITypes.OWNERSHIP_READ_SSI, dlDomain, hashPrivateKey, hashPublicKeyLevelAndToken, vn, hint);
    };

    self.derive = (callback) => {
        const zatSSI = ZATSSI.createZATSSI();
        const token = self.getToken();
        const hashPublicKey = self.getHashPublicKey();
        zatSSI.load(
            SSITypes.ZERO_ACCESS_TOKEN_SSI,
            self.getDLDomain(),
            token,
            hashPublicKey,
            self.getVn(),
            self.getHint()
        );
        callback(undefined, zatSSI);
    };

    self.getEncryptionKey = (callback) => {
        const encryptionKey = cryptoRegistry.getBase64DecodingFunction(self)(self.getHashPublicKey());
        callback(undefined, encryptionKey);
    };

    const getControlParts = function () {
        let control = self.getControlString();
        if (control == null) {
            throw Error("Operation requested on an invalid OwnershipSSI. Initialise first");
        }
        return control.split("/");
    };

    self.getHashPublicKey = function () {
        let token = getControlParts()[0];
        return token;
    };

    self.getLevel = function () {
        let level = getControlParts()[1];
        return level;
    };

    self.getToken = function () {
        let token = getControlParts()[2];
        return token;
    };
}

function createOReadSSI(identifier) {
    return new OReadSSI(identifier);
}

module.exports = {
    createOReadSSI
};
