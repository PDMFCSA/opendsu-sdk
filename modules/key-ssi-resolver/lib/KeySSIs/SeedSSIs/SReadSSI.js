const KeySSIMixin = require("../KeySSIMixin");
const SZaSSI = require("./SZaSSI");
const SSITypes = require("../SSITypes");
const cryptoRegistry = require("../../CryptoAlgorithms/CryptoAlgorithmsRegistry");
const SSIFamilies = require("../SSIFamilies");

function SReadSSI(enclave, identifier) {
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
        return SSITypes.SREAD_SSI;
    }

    self.initialize = (dlDomain, vn, hint) => {
        self.load(SSITypes.SREAD_SSI, dlDomain, "", undefined, vn, hint);
    };

    self.deriveSync = () => {
        const sZaSSI = SZaSSI.createSZaSSI();
        const subtypeKey = '';
        const subtypeControl = self.getControlString();
        sZaSSI.load(SSITypes.SZERO_ACCESS_SSI, self.getDLDomain(), subtypeKey, subtypeControl, self.getVn(), self.getHint());

        return sZaSSI;
    }

    self.derive = (callback) => {
        try {
            const sZaSSI = self.deriveSync();
            return callback(undefined, sZaSSI);
        } catch (e) {
            return callback(e);
        }
    };

    self.getEncryptionKey = (callback) => {
        const encryptionKey = cryptoRegistry.getDecodingFunction(self)(self.getSpecificString());
        callback(undefined, encryptionKey);
    };

    self.getPublicKey = (options) => {
        let publicKey = cryptoRegistry.getBase64DecodingFunction(self)(self.getControlString());
        return cryptoRegistry.getConvertPublicKeyFunction(self)(publicKey, options);
    };

    self.getFamilyName = () => {
        return SSIFamilies.SEED_SSI_FAMILY;
    }
}

function createSReadSSI(enclave, identifier) {
    return new SReadSSI(enclave, identifier)
}

module.exports = {
    createSReadSSI
};
