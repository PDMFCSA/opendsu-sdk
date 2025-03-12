const KeySSIMixin = require("../KeySSIMixin");
const ReadSSI = require("./ReadSSI");
const SSITypes = require("../SSITypes");
const cryptoRegistry = require("../../CryptoAlgorithms/CryptoAlgorithmsRegistry");

function AnchorSSI(identifier) {
    KeySSIMixin(this);

    if (typeof identifier !== "undefined") {
        this.autoLoad(identifier);
    }

    this.derive = (callback) => {
        const readSSI = ReadSSI.createReadSSI();
        this.getEncryptionKey((err, encryptionKey) => {
            if (err) {
                return callback(err);
            }

            const subtypeKey = cryptoRegistry.getHashFunction(this)(encryptionKey);
            readSSI.load(SSITypes.READ_SSI, this.getDLDomain(), subtypeKey, this.getControlString(), this.getVn(), this.getHint());
            callback(undefined, readSSI);
        });
    };
}

function createAnchorSSI(identifier) {
    return new AnchorSSI(identifier);
}

module.exports = {
    createAnchorSSI
}
