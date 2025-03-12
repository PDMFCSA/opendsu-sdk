const KeySSIMixin = require("../KeySSIMixin");
const SSITypes = require("../SSITypes");
const cryptoRegistry = require("../../CryptoAlgorithms/CryptoAlgorithmsRegistry");
const SSIFamilies = require("../SSIFamilies");

function SZaSSI(enclave, identifier) {
    if (typeof enclave === "string") {
        identifier = enclave;
        enclave = undefined;
    }
    const self = this;
    KeySSIMixin(self, enclave);

    if (typeof identifier !== "undefined") {
        self.autoLoad(identifier);
    }

    self.getTypeName = function () {
        return SSITypes.SZERO_ACCESS_SSI;
    }

    self.initialize = (dlDomain, hpk, vn, hint) => {
        self.load(SSITypes.SZERO_ACCESS_SSI, dlDomain, '', hpk, vn, hint);
    };

    self.getPublicKey = (options) => {
        let publicKey = cryptoRegistry.getBase64DecodingFunction(self)(self.getControlString());
        return cryptoRegistry.getConvertPublicKeyFunction(self)(publicKey, options);
    };

    self.getFamilyName = () => {
        return SSIFamilies.SEED_SSI_FAMILY;
    }
}

function createSZaSSI(enclave, identifier) {
    return new SZaSSI(enclave, identifier);
}

module.exports = {
    createSZaSSI
};
