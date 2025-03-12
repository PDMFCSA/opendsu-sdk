const KeySSIMixin = require("../KeySSIMixin");
const SSITypes = require("../SSITypes");

function TokenSSI(enclave, identifier) {
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
        return SSITypes.TOKEN_SSI;
    }

    self.initialize = function (dlDomain, amount, hashInitialOwnerPublicKey, vn, hint, callback) {
        if (typeof amount === "function") {
            callback = amount;
            amount = undefined;
        }
        if (typeof hashInitialOwnerPublicKey === "function") {
            callback = hashInitialOwnerPublicKey;
            hashInitialOwnerPublicKey = undefined;
        }
        if (typeof vn === "function") {
            callback = vn;
            vn = "v0";
        }
        if (typeof hint === "function") {
            callback = hint;
            hint = undefined;
        }

        self.load(SSITypes.TOKEN_SSI, dlDomain, amount, hashInitialOwnerPublicKey, vn, hint);
        if (callback) {
            callback(undefined, self);
        }

        self.initialize = function () {
            throw Error("KeySSI already initialized");
        };
    };

    self.takeOwnership = function (ownershipSSI, callback) {
        // will give token ownership to another generated ownershipSSI
        throw Error("Not implemented");
        // callback(err, newOwnershipSSI);
    };

    self.giveOwnership = function (ownershipSSI, oReadSSI, callback) {
        // will give token ownership to another specified oReadSSI
        throw Error("Not implemented");
        // callback(err, transferSSI);
    };
}

function createTokenSSI(enclave, identifier) {
    return new TokenSSI(enclave, identifier);
}

module.exports = {
    createTokenSSI
};
