const KeySSIMixin = require("../KeySSIMixin");
const ZaSSI = require("./ZaSSI");
const SSITypes = require("../SSITypes");
const cryptoRegistry = require("../../CryptoAlgorithms/CryptoAlgorithmsRegistry");

function PublicSSI(identifier) {
    KeySSIMixin(this);

    if (typeof identifier !== "undefined") {
        this.autoLoad(identifier);
    }

    this.derive = () => {
        const zaSSI = ZaSSI.createZaSSI();
        const subtypeKey = cryptoRegistry.getHashFunction(this)(this.getEncryptionKey())
        zaSSI.initialize(SSITypes.ZERO_ACCESS_SSI, this.getDLDomain(), subtypeKey, this.getControlString(), this.getVn(), this.getHint());
        return zaSSI;
    };
}

function createPublicSSI(identifier) {
    return new PublicSSI(identifier);
}

module.exports = {
    createPublicSSI
};
