function CryptoAlgorithmsMixin(target) {
    target = target || {};
    const crypto = require("pskcrypto");

    target.hash = (data) => {
        return target.encoding(crypto.hash('sha256', data));
    }

    target.keyDerivation = (password, iterations) => {
        return crypto.deriveKey('aes-256-gcm', password, iterations);
    }

    target.encryptionKeyGeneration = () => {
        const pskEncryption = crypto.createPskEncryption('aes-256-gcm');
        return pskEncryption.generateEncryptionKey();
    }

    target.encryption = (plainData, encryptionKey, options) => {
        const pskEncryption = crypto.createPskEncryption('aes-256-gcm');
        return pskEncryption.encrypt(plainData, encryptionKey, options);
    }

    target.decryption = (encryptedData, decryptionKey, authTagLength, options) => {
        const pskEncryption = crypto.createPskEncryption('aes-256-gcm');
        const utils = require("swarmutils");
        if (!$$.Buffer.isBuffer(decryptionKey) && (decryptionKey instanceof ArrayBuffer || ArrayBuffer.isView(decryptionKey))) {
            decryptionKey = utils.ensureIsBuffer(decryptionKey);
        }
        if (!$$.Buffer.isBuffer(encryptedData) && (decryptionKey instanceof ArrayBuffer || ArrayBuffer.isView(decryptionKey))) {
            encryptedData = utils.ensureIsBuffer(encryptedData);
        }
        return pskEncryption.decrypt(encryptedData, decryptionKey, 16, options);
    }

    target.encoding = (data) => {
        return crypto.pskBase58Encode(data);
    }

    target.decoding = (data) => {
        return crypto.pskBase58Decode(data);
    }

    target.base64Encoding = (data) => {
        return crypto.pskBase64Encode(data);
    }

    target.base64Decoding = (data) => {
        return crypto.pskBase64Decode(data);
    }

    target.keyPairGenerator = () => {
        return crypto.createKeyPairGenerator();
    }

    target.convertPublicKey = (rawPublicKey, options) => {
        const keyGenerator = crypto.createKeyPairGenerator();
        return keyGenerator.convertPublicKey(rawPublicKey, options);
    };

    target.verify = (data, publicKey, signature) => {
        return crypto.verifyETH(data, signature, publicKey);
    }

    target.ecies_encryption = (receiverPublicKey, message) => {
        return crypto.ecies_encrypt(receiverPublicKey, message, target.getConfigForIES())
    };

    target.ecies_decryption = (receiverPrivateKey, encEnvelope) => {
        return crypto.ecies_decrypt(receiverPrivateKey, encEnvelope, target.getConfigForIES());
    };

    target.ecies_encryption_ds = (senderKeyPair, receiverPublicKey, message) => {
        return crypto.ecies_encrypt_ds(senderKeyPair, receiverPublicKey, message, target.getConfigForIES())
    };

    target.ecies_decryption_ds = (receiverPrivateKey, encEnvelope) => {
        return crypto.ecies_decrypt_ds(receiverPrivateKey, encEnvelope, target.getConfigForIES());
    };

    target.ecies_encryption_kmac = (senderKeyPair, receiverPublicKey, message) => {
        return crypto.ecies_encrypt_kmac(senderKeyPair, receiverPublicKey, message, target.getConfigForIES())
    };

    target.ecies_decryption_kmac = (receiverPrivateKey, encEnvelope) => {
        return crypto.ecies_decrypt_kmac(receiverPrivateKey, encEnvelope, target.getConfigForIES());
    };

    let config = {
        curveName: 'secp256k1',
        encodingFormat: 'base64',
        macAlgorithmName: 'sha256',
        macKeySize: 16,
        hashFunctionName: 'sha256',
        hashSize: 32,
        signAlgorithmName: 'sha256',
        symmetricCipherName: 'aes-128-cbc',
        symmetricCipherKeySize: 16,
        ivSize: 16
    };

    target.getConfigForIES = () => {
        return config;
    };

    target.setConfigForIES = (_config) => {
        config = _config;
    }

    return target;
}

module.exports = CryptoAlgorithmsMixin;
