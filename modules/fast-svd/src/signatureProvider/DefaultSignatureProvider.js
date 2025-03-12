function DefaultSignatureProvider(privateKey) {
    const openDSU = require('opendsu');
    const crypto = openDSU.loadAPI('crypto');
    const keySSISpace = openDSU.loadAPI('keyssi');
    const templateSeedSSI = keySSISpace.createTemplateSeedSSI("default");
    const constants = openDSU.constants;
    this.sign = (blockNumber, change) => {
        const signFn = crypto.getCryptoFunctionForKeySSI(templateSeedSSI, constants.CRYPTO_FUNCTION_TYPES.SIGN);
        const data = `${blockNumber}${change}`;
        return signFn(data, privateKey);
    }
    this.verify = (publicKey, data, signature) => {
        const verifyFn = crypto.getCryptoFunctionForKeySSI(templateSeedSSI, constants.CRYPTO_FUNCTION_TYPES.VERIFY);
        return verifyFn(data, publicKey, signature);
    }
}

module.exports.create = function (privateKey) {
    return new DefaultSignatureProvider(privateKey);
}