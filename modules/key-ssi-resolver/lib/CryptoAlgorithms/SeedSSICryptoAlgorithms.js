function SeedSSICryptoAlgorithms() {
    const crypto = require("pskcrypto");
    const CryptoAlgorithmsMixin = require("./CryptoAlgorithmsMixin");
    CryptoAlgorithmsMixin(this);
    const self = this;

    self.sign = (data, privateKey) => {
        return crypto.signETH(data, privateKey);
    }

    self.derivePublicKey = (privateKey, format) => {
        if (typeof format === "undefined") {
            format = "pem";
        }
        const keyGenerator = crypto.createKeyPairGenerator();
        let publicKey = keyGenerator.getPublicKey(privateKey, 'secp256k1');
        switch (format) {
            case "raw":
                return publicKey;
            case "pem":
                return keyGenerator.getPemKeys(privateKey, publicKey).publicKey;
            default:
                throw Error("Invalid format name");
        }
    }
}

module.exports = SeedSSICryptoAlgorithms;
