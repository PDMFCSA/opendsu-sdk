const KeySSIMixin = require("../KeySSIMixin");
const SSITypes = require("../SSITypes");
const cryptoRegistry = require("../../CryptoAlgorithms/CryptoAlgorithmsRegistry");
const keySSIFactory = require("../KeySSIFactory");

function TransferSSI(enclave, identifier) {
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
        return SSITypes.TRANSFER_SSI;
    }

    self.initialize = function (dlDomain, newPublicKey, timestamp, signature, vn, hint, callback) {
        if (typeof vn === "function") {
            callback = vn;
            vn = "v0";
        }
        if (typeof hint === "function") {
            callback = hint;
            hint = undefined;
        }

        self.load(SSITypes.TRANSFER_SSI, dlDomain, newPublicKey, `${timestamp}/${signature}`, vn, hint);

        if (callback) {
            callback(undefined, self);
        }

        self.initialize = function () {
            throw Error("KeySSI already initialized");
        };
    };

    self.getPublicKeyHash = function () {
        return self.getSpecificString();
    };

    self.getTimestamp = function () {
        let control = self.getControlString();
        return control.split("/")[0];
    }

    self.getSignature = function (encoding) {
        if (typeof encoding === "undefined") {
            encoding = "base64";
        }
        let control = self.getControlString();
        let splitControl = control.split("/");
        let signature = splitControl[1];
        if (encoding === "raw") {
            const base64Decode = cryptoRegistry.getBase64DecodingFunction(self);
            return base64Decode(signature);
        }
        return signature;
    }

    self.getPublicKey = (options) => {
        let publicKey = cryptoRegistry.getBase64DecodingFunction(self)(self.getSpecificString());
        return cryptoRegistry.getConvertPublicKeyFunction(self)(publicKey, options);
    };

    self.getDataToSign = function (anchorSSI, previousAnchorValue) {
        if (typeof anchorSSI === "string") {
            anchorSSI = keySSIFactory.create(anchorSSI);
        }

        if (typeof previousAnchorValue === "string") {
            previousAnchorValue = keySSIFactory.create(previousAnchorValue);
        }

        let previousIdentifier = '';
        const timestamp = self.getTimestamp();
        if (previousAnchorValue) {
            previousIdentifier = previousAnchorValue.getIdentifier(true);
        }
        return anchorSSI.getIdentifier(true) + self.getSpecificString() + previousIdentifier + timestamp;
    }

    self.isTransfer = function () {
        return true;
    }
}

function createTransferSSI(enclave, identifier) {
    return new TransferSSI(enclave, identifier);
}

module.exports = {
    createTransferSSI
};
