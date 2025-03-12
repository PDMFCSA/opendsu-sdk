const methodsNames = require("../didMethodsNames");

function SSIKeyDID_Document(enclave, isInitialisation, seedSSI) {
    let DID_mixin = require("../W3CDID_Mixin");
    DID_mixin(this, enclave);
    const ObservableMixin = require("../../utils/ObservableMixin");
    ObservableMixin(this);
    const openDSU = require("opendsu");
    const keySSISpace = openDSU.loadAPI("keyssi");
    const crypto = openDSU.loadAPI("crypto");

    let tokens;
    const __init = async () => {
        if (!isInitialisation) {
            tokens = seedSSI;
            seedSSI = undefined;
        }

        if (typeof seedSSI === "string") {
            try {
                seedSSI = keySSISpace.parse(seedSSI);
            } catch (e) {
                return this.dispatchEvent("error", createOpenDSUErrorWrapper(`Failed to parse ssi ${seedSSI}`));
            }
        }

        setTimeout(()=>{
            this.dispatchEvent("initialised");
        },1)
    }

    this.getMethodName = () => {
        return methodsNames.SSI_KEY_SUBTYPE;
    }

    this.getDomain = () => {
        let domain;
        if (!isInitialisation) {
            domain = tokens[0];
        } else {
            domain = seedSSI.getDLDomain();
        }

        return domain;
    }

    const getRawPublicKey = () => {
        let publicKey;
        if (!isInitialisation) {
            publicKey = crypto.decodeBase58(tokens[1])
        } else {
            publicKey = seedSSI.getPublicKey("raw");
        }

        return publicKey;
    }

    this.getPublicKey = (format, callback) => {
        let pubKey = getRawPublicKey();
        try {
            pubKey = crypto.convertPublicKey(pubKey, format);
        } catch (e) {
            return callback(createOpenDSUErrorWrapper(`Failed to convert public key to ${format}`, e));
        }

        callback(undefined, pubKey);
    };

    this.getIdentifier = () => {
        const domain = this.getDomain();
        let publicKey = getRawPublicKey();
        publicKey = crypto.encodeBase58(publicKey);
        return `did:ssi:key:${domain}:${publicKey}`;
    };

    this.getPrivateKeys = () => {
        if(typeof seedSSI === "undefined"){
           throw Error("SeedSSI is not defined");
        }
        return [seedSSI.getPrivateKey()];
    };

    __init();
    return this;
}

module.exports = {
    initiateDIDDocument: function (enclave, seedSSI) {
        return new SSIKeyDID_Document(enclave, true, seedSSI);
    },
    createDIDDocument: function (enclave, tokens) {
        return new SSIKeyDID_Document(enclave, false,  [tokens[3], tokens[4]]);
    }
};
