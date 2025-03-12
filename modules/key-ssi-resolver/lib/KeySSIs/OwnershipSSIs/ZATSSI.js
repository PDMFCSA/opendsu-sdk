const KeySSIMixin = require("../KeySSIMixin");
const SSITypes = require("../SSITypes");

function ZATSSI(identifier) {
    const self = this;
    KeySSIMixin(self);

    if (typeof identifier !== "undefined") {
        self.autoLoad(identifier);
    }

    self.getTypeName = function () {
        return SSITypes.ZERO_ACCESS_TOKEN_SSI;
    }

    self.initialize = (dlDomain, token, hashInitialOwnerPublicKey, vn, hint) => {
        self.load(SSITypes.ZERO_ACCESS_TOKEN_SSI, dlDomain, token, hashInitialOwnerPublicKey, vn, hint);
    };


}

function createZATSSI(identifier) {
    return new ZATSSI(identifier);
}

module.exports = {
    createZATSSI
};
