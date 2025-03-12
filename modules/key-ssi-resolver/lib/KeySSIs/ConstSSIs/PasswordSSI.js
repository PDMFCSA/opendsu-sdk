const KeySSIMixin = require("../KeySSIMixin");
const ConstSSI = require("./ConstSSI");
const SSITypes = require("../SSITypes");
const cryptoRegistry = require("../../CryptoAlgorithms/CryptoAlgorithmsRegistry");

function PasswordSSI(enclave, identifier) {
    if (typeof enclave === "string") {
        identifier = enclave;
        enclave = undefined;
    }
    KeySSIMixin(this, enclave);
    const self = this;

    if (typeof identifier !== "undefined") {
        self.autoLoad(identifier);
    }

    self.initialize = (dlDomain, context, password, kdfOptions, vn, hint) => {
        const subtypeSpecificString = cryptoRegistry.getKeyDerivationFunction(self)(context + password, kdfOptions);
        self.load(SSITypes.PASSWORD_SSI, dlDomain, subtypeSpecificString, '', vn, hint);
    };

    self.derive = (callback) => {
        const constSSI = ConstSSI.createConstSSI();
        constSSI.load(SSITypes.CONST_SSI, self.getDLDomain(), self.getSpecificString(), self.getControlString(), self.getVn(), self.getHint());
        callback(constSSI);
    };

    self.getEncryptionKey = (callback) => {
        self.derive((err, constSSI) => {
            if (err) {
                return callback(err);
            }

            constSSI.getEncryptionKey(callback);
        })
    };
}

function createPasswordSSI(enclave, identifier) {
    return new PasswordSSI(enclave, identifier);
}

module.exports = {
    createPasswordSSI
};
