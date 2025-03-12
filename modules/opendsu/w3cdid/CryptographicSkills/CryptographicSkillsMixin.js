function CryptographicSkillsMixin(target) {
    target = target || {};
    const crypto = require("pskcrypto");
    const openDSU = require("opendsu");
    const keySSISpace = openDSU.loadAPI("keyssi");
    const cryptoSpace = openDSU.loadAPI("crypto");

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

    target.keyPairGenerator = () => {
        return crypto.createKeyPairGenerator();
    }

    target.convertPublicKey = (rawPublicKey, options) => {
        const keyGenerator = crypto.createKeyPairGenerator();
        return keyGenerator.convertPublicKey(rawPublicKey, options);
    };

    target.sign = (data, privateKey) => {
        const keyGenerator = crypto.createKeyPairGenerator();
        const rawPublicKey = keyGenerator.getPublicKey(privateKey, 'secp256k1');
        return crypto.sign('sha256', data, keyGenerator.getPemKeys(privateKey, rawPublicKey).privateKey);
    }

    target.verify = (data, publicKey, signature) => {
        return crypto.verify('sha256', data, publicKey, signature);
    }

    target.ecies_encryption = (receiverPublicKey, message) => {
        return crypto.ecies_encrypt(receiverPublicKey, message, target.getConfigForIES())
    };

    target.ecies_decryption = (receiverPrivateKey, encEnvelope) => {
        return crypto.ecies_decrypt(receiverPrivateKey, encEnvelope, target.getConfigForIES());
    };

    target.encryptMessage = (privateKeys, didFrom, didTo, message, callback) => {
        const senderSeedSSI = keySSISpace.createTemplateSeedSSI(didFrom.getDomain());
        try {
            senderSeedSSI.initialize(didFrom.getDomain(), privateKeys[privateKeys.length - 1]);
        } catch (e) {
            return callback(createOpenDSUErrorWrapper(`Failed to initialize seedSSI`, e));
        }

        didTo.getPublicKey("raw", async (err, receiverPublicKey) => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to get sender publicKey`, err));
            }

            const publicKeySSI = keySSISpace.createPublicKeySSI("seed", receiverPublicKey);

            const __encryptMessage = (senderKeySSI) => {
                let encryptedMessage;
                try {
                    encryptedMessage = cryptoSpace.ecies_encrypt_ds(senderKeySSI, publicKeySSI, message);
                } catch (e) {
                    return callback(createOpenDSUErrorWrapper(`Failed to encrypt message`, e));
                }

                callback(undefined, encryptedMessage);
            };

            __encryptMessage(senderSeedSSI);
        });
    };

    target.decryptMessage = (privateKeys, didTo, encryptedMessage, callback) => {
        let decryptedMessageObj;
        const decryptMessageRecursively = (privateKeyIndex) => {
            if(privateKeyIndex >= privateKeys.length){
                return callback(createOpenDSUErrorWrapper(`Failed to decrypt message`, new Error("No private key available")));
            }
            const privateKey = privateKeys[privateKeyIndex];

            if (!privateKey) {
                return decryptMessageRecursively(privateKeyIndex + 1);
            }

            const receiverSeedSSI = keySSISpace.createTemplateSeedSSI(didTo.getDomain());
            try {
                receiverSeedSSI.initialize(didTo.getDomain(), privateKey);
            } catch (e) {
                return callback(createOpenDSUErrorWrapper(`Failed to initialize seedSSI`, e));
            }
            try {
                decryptedMessageObj = cryptoSpace.ecies_decrypt_ds(receiverSeedSSI, encryptedMessage);
            } catch (e) {
                return decryptMessageRecursively(privateKeyIndex + 1);
            }

            callback(undefined, decryptedMessageObj.message.toString());
        };

        decryptMessageRecursively(0);
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

    return target;
}

module.exports = CryptographicSkillsMixin;
