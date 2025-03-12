const KeySSIMixin = require("../KeySSIMixin");
const {createHashLinkSSI} = require("./HashLinkSSI");
const SSITypes = require("../SSITypes");
const cryptoRegistry = require("../../CryptoAlgorithms/CryptoAlgorithmsRegistry");
const SSIFamilies = require("../SSIFamilies");

function SignedHashLinkSSI(enclave, identifier) {
    if (typeof enclave === "string") {
        identifier = enclave;
        enclave = undefined;
    }
    const SEPARATOR = "|";
    KeySSIMixin(this, enclave);
    const self = this;

    if (typeof identifier !== "undefined") {
        self.autoLoad(identifier);
    }

    self.getTypeName = function () {
        return SSITypes.SIGNED_HASH_LINK_SSI;
    }

    self.initialize = (dlDomain, hash, timestamp, signature, vn, hint) => {
        self.load(SSITypes.SIGNED_HASH_LINK_SSI, dlDomain, hash, `${timestamp}${SEPARATOR}${signature}`, vn, hint);
    };

    self.canBeVerified = () => {
        return true;
    };

    self.getHash = () => {
        const specificString = self.getSpecificString();
        if (typeof specificString !== "string") {
            console.trace("Specific string is not string", specificString.toString());
        }
        return specificString;
    };


    self.deriveSync = () => {
        const hashLinkSSI = createHashLinkSSI();
        hashLinkSSI.load(SSITypes.HASH_LINK_SSI, self.getDLDomain(), self.getHash(), "", self.getVn(), self.getHint());
        return hashLinkSSI;
    };


    self.derive = (callback) => {
        try {
            const hashLinkSSI = self.deriveSync();
            callback(undefined, hashLinkSSI);
        } catch (e) {
            return callback(e);
        }
    };

    self.getTimestamp = function () {
        let control = self.getControlString();
        return control.split(SEPARATOR)[0];
    }

    self.getSignature = function (encoding) {
        if (typeof encoding === "undefined") {
            encoding = "base64";
        }
        let control = self.getControlString();
        let splitControl = control.split(SEPARATOR);
        let signature = splitControl[1];
        if (encoding === "raw") {
            const base64Decode = cryptoRegistry.getBase64DecodingFunction(self);
            return base64Decode(signature);
        }

        return signature;
    }

    self.getDataToSign = function (anchorSSI, previousAnchorValue) {
        const keySSIFactory = require("../KeySSIFactory");

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

    self.getFamilyName = () => {
        return SSIFamilies.HASH_LINK_SSI_FAMILY;
    }
}

function createSignedHashLinkSSI(enclave, identifier) {
    return new SignedHashLinkSSI(enclave, identifier);
}

module.exports = {
    createSignedHashLinkSSI
};
