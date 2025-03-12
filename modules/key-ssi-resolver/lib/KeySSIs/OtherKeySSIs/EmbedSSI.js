const KeySSIMixin = require("../KeySSIMixin");
const SSITypes = require("../SSITypes");
const cryptoRegistry = require("../../CryptoAlgorithms/CryptoAlgorithmsRegistry");

function EmbedSSI(enclave, identifier) {
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
        return SSITypes.EMBED_SSI;
    }

    const originalGetSpecificString = self.getSpecificString;

    self.initialize = (dlDomain, data, vn, hint) => {
        if (!$$.Buffer.isBuffer(data)) {
            data = $$.Buffer.from(data);
        }
        data = cryptoRegistry.getBase64EncodingFunction(self)(data);
        self.load(SSITypes.EMBED_SSI, dlDomain, data, '', vn, hint);
    };

    self.getSpecificString = () => {
        return cryptoRegistry.getBase64DecodingFunction(self)(originalGetSpecificString());
    }

    self.isEmbed = () => {
        return true;
    }


}

function createEmbedSSI(enclave, identifier) {
    return new EmbedSSI(enclave, identifier);
}

module.exports = {
    createEmbedSSI
};
