const SSITypes = require("../KeySSIs/SSITypes");
const CryptoFunctionTypes = require("./CryptoFunctionTypes");
const CryptoAlgorithmsMixin = require("./CryptoAlgorithmsMixin");
const SeedSSICryptoAlgorithms = require("./SeedSSICryptoAlgorithms");
const cryptoInterfaces = {};

const registerCryptoInterface = (keySSIType, vn, cryptoInterface) => {
    if (typeof cryptoInterfaces[keySSIType] !== "undefined" && typeof cryptoInterfaces[keySSIType][vn] !== "undefined") {
        throw Error(`A crypto interface for Key SSI ${keySSIType} is already registered for version ${vn}`);
    }

    if (typeof cryptoInterfaces[keySSIType] === "undefined") {
        cryptoInterfaces[keySSIType] = {};
    }

    cryptoInterfaces[keySSIType][vn] = cryptoInterface;
};

const getCryptoFunction = (keySSI, algorithmType) => {
    let cryptoFunction;
    try {
        cryptoFunction = cryptoInterfaces[keySSI.getTypeName()][keySSI.getVn()][algorithmType];
    } catch (e) {
        throw Error(`Algorithm type <${algorithmType}> not recognized for <${keySSI.getIdentifier(true)}>`);
    }

    if (typeof cryptoFunction === "undefined") {
        throw Error(`Algorithm type <${algorithmType}> not recognized for <${keySSI.getIdentifier(true)}>`);
    }
    return cryptoFunction;
};

function CryptoAlgorithmsRegistry() {
}

module.exports = new CryptoAlgorithmsRegistry();
CryptoAlgorithmsRegistry.prototype.getHashFunction = (keySSI) => {
    return getCryptoFunction(keySSI, CryptoFunctionTypes.HASH);
};

CryptoAlgorithmsRegistry.prototype.getKeyDerivationFunction = (keySSI) => {
    return getCryptoFunction(keySSI, CryptoFunctionTypes.KEY_DERIVATION);
};

CryptoAlgorithmsRegistry.prototype.getEncryptionFunction = (keySSI) => {
    return getCryptoFunction(keySSI, CryptoFunctionTypes.ENCRYPTION);
};

CryptoAlgorithmsRegistry.prototype.getEncryptionKeyGenerationFunction = (keySSI) => {
    return getCryptoFunction(keySSI, CryptoFunctionTypes.ENCRYPTION_KEY_GENERATION);
};

CryptoAlgorithmsRegistry.prototype.getDecryptionFunction = (keySSI) => {
    return getCryptoFunction(keySSI, CryptoFunctionTypes.DECRYPTION);
};

CryptoAlgorithmsRegistry.prototype.getEncodingFunction = (keySSI) => {
    return getCryptoFunction(keySSI, CryptoFunctionTypes.ENCODING);
};

CryptoAlgorithmsRegistry.prototype.getDecodingFunction = (keySSI) => {
    return getCryptoFunction(keySSI, CryptoFunctionTypes.DECODING);
};

CryptoAlgorithmsRegistry.prototype.getBase64EncodingFunction = (keySSI) => {
    return getCryptoFunction(keySSI, CryptoFunctionTypes.BASE64_ENCODING);
};

CryptoAlgorithmsRegistry.prototype.getBase64DecodingFunction = (keySSI) => {
    return getCryptoFunction(keySSI, CryptoFunctionTypes.BASE64_DECODING);
};

CryptoAlgorithmsRegistry.prototype.getKeyPairGenerator = (keySSI) => {
    return getCryptoFunction(keySSI, CryptoFunctionTypes.KEY_PAIR_GENERATOR);
};

CryptoAlgorithmsRegistry.prototype.getSignFunction = (keySSI) => {
    return getCryptoFunction(keySSI, CryptoFunctionTypes.SIGN);
};

CryptoAlgorithmsRegistry.prototype.getVerifyFunction = (keySSI) => {
    return getCryptoFunction(keySSI, CryptoFunctionTypes.VERIFY);
};

CryptoAlgorithmsRegistry.prototype.getDerivePublicKeyFunction = (keySSI) => {
    return getCryptoFunction(keySSI, CryptoFunctionTypes.DERIVE_PUBLIC_KEY);
};

CryptoAlgorithmsRegistry.prototype.getConvertPublicKeyFunction = (keySSI) => {
    return getCryptoFunction(keySSI, CryptoFunctionTypes.CONVERT_PUBLIC_KEY);
};

CryptoAlgorithmsRegistry.prototype.getCryptoFunction = getCryptoFunction;
CryptoAlgorithmsRegistry.prototype.registerCryptoInterface = registerCryptoInterface;

CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.SEED_SSI, 'v0', new SeedSSICryptoAlgorithms());
CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.PATH_SSI, 'v0', new CryptoAlgorithmsMixin());
CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.WALLET_SSI, 'v0', new SeedSSICryptoAlgorithms());
CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.SREAD_SSI, 'v0', new CryptoAlgorithmsMixin());
CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.SZERO_ACCESS_SSI, 'v0', new CryptoAlgorithmsMixin());

CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.PASSWORD_SSI, 'v0', new CryptoAlgorithmsMixin());
CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.ARRAY_SSI, 'v0', new SeedSSICryptoAlgorithms());
CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.CONST_SSI, 'v0', new SeedSSICryptoAlgorithms());
CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.CONSTANT_ZERO_ACCESS_SSI, 'v0', new CryptoAlgorithmsMixin());
CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.HASH_LINK_SSI, 'v0', new CryptoAlgorithmsMixin());
CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.SYMMETRICAL_ENCRYPTION_SSI, 'v0', new CryptoAlgorithmsMixin());
CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.EMBED_SSI, 'v0', new CryptoAlgorithmsMixin());
CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.VERSIONLESS_SSI, 'v0', new CryptoAlgorithmsMixin());

CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.TOKEN_SSI, 'v0', new CryptoAlgorithmsMixin());
CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.OWNERSHIP_SSI, 'v0', new SeedSSICryptoAlgorithms());
CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.OWNERSHIP_READ_SSI, 'v0', new CryptoAlgorithmsMixin());
CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.TRANSFER_SSI, 'v0', new SeedSSICryptoAlgorithms());
CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.ZERO_ACCESS_TOKEN_SSI, 'v0', new CryptoAlgorithmsMixin());
CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.SIGNED_HASH_LINK_SSI, 'v0', new CryptoAlgorithmsMixin());

CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.CONSENSUS_SSI, 'v0', new CryptoAlgorithmsMixin());
CryptoAlgorithmsRegistry.prototype.registerCryptoInterface(SSITypes.PUBLIC_KEY_SSI, 'v0', new CryptoAlgorithmsMixin());

