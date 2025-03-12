const KeySSIMixin = require("../KeySSIMixin");
const SSITypes = require("../SSITypes");
const cryptoRegistry = require("../../CryptoAlgorithms/CryptoAlgorithmsRegistry");

function PublicKeySSI(enclave, identifier) {
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
        return SSITypes.PUBLIC_KEY_SSI;
    }

    self.initialize = (compatibleFamilyName, publicKey, vn) => {
        publicKey = cryptoRegistry.getBase64EncodingFunction(self)(publicKey);
        self.load(SSITypes.PUBLIC_KEY_SSI, '', compatibleFamilyName, publicKey, vn);
    };

    self.getPublicKey = (format) => {
        let publicKey = cryptoRegistry.getBase64DecodingFunction(self)(self.getControlString());
        if (format !== "raw") {
            publicKey = cryptoRegistry.getConvertPublicKeyFunction(self)(publicKey, {outputFormat: format});
        }

        return publicKey;
    };

    self.generateCompatiblePowerfulKeySSI = (callback) => {
        const keySSIFactory = require("../KeySSIFactory");
        const powerfulSSI = keySSIFactory.createType(self.getSpecificString());
        powerfulSSI.initialize(self.getDLDomain(), undefined, undefined, self.getVn(), callback);
    }

}

function createPublicKeySSI(enclave, identifier) {
    return new PublicKeySSI(enclave, identifier);
}

module.exports = {
    createPublicKeySSI
};
