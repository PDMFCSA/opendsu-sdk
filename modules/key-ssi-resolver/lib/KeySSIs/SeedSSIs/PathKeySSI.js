const KeySSIMixin = require("../KeySSIMixin");
const SeedSSI = require("./SeedSSI");
const SSITypes = require("../SSITypes");
const cryptoRegistry = require("../../CryptoAlgorithms/CryptoAlgorithmsRegistry");
const SSIFamilies = require("../SSIFamilies");

function PathKeySSI(enclave, identifier) {
    if (typeof enclave === "string") {
        identifier = enclave;
        enclave = undefined;
    }
    KeySSIMixin(this, enclave);
    const self = this;
    let privateKey;

    if (typeof identifier !== "undefined") {
        self.autoLoad(identifier);
    }

    self.getTypeName = function () {
        return SSITypes.PATH_SSI;
    }

    self.setCanSign(true);

    const _getEnclave = (callback) => {
        const openDSU = require("opendsu")
        const scAPI = openDSU.loadAPI("sc")
        scAPI.getSharedEnclave((err, sharedEnclave) => {
            if (err) {
                return scAPI.getMainEnclave(callback);
            }

            callback(undefined, sharedEnclave);
        });
    }

    self.deriveSync = () => {
        throw Error("PathSSIs cannot be derived synchronously");
    }

    self.derive = function (callback) {
        const specificString = self.getSpecificString();
        const index = specificString.indexOf("/");
        const slot = specificString.slice(0, index);
        const path = specificString.slice(index + 1);

        const __getPrivateKeyForSlot = () => {
            enclave.getPrivateKeyForSlot(slot, (err, _privateKey) => {
                if (err) {
                    return callback(err);
                }

                try {
                    privateKey = _privateKey;
                    privateKey = cryptoRegistry.getHashFunction(self)(`${path}${toString(privateKey)}`);
                    privateKey = cryptoRegistry.getDecodingFunction(self)(privateKey);
                    const seedSpecificString = cryptoRegistry.getBase64EncodingFunction(self)(privateKey);
                    const seedSSI = SeedSSI.createSeedSSI(enclave);
                    seedSSI.load(SSITypes.SEED_SSI, self.getDLDomain(), seedSpecificString, undefined, self.getVn(), self.getHint());
                    callback(undefined, seedSSI);
                } catch (e) {
                    callback(e);
                }
            });
        }

        if (typeof enclave === "undefined") {
            _getEnclave((err, _enclave) => {
                if (err) {
                    return callback(err);
                }

                enclave = _enclave;
                __getPrivateKeyForSlot();
            })

            return;
        }

        __getPrivateKeyForSlot();
    };

    self.getPrivateKey = function (format) {
        let validSpecificString = self.getSpecificString();
        if (validSpecificString === undefined) {
            throw Error("Operation requested on an invalid SeedSSI. Initialise first")
        }
        let privateKey = cryptoRegistry.getBase64DecodingFunction(self)(validSpecificString);
        if (format === "pem") {
            const pemKeys = cryptoRegistry.getKeyPairGenerator(self)().getPemKeys(privateKey, self.getPublicKey("raw"));
            privateKey = pemKeys.privateKey;
        }
        return privateKey;
    }

    self.sign = function (dataToSign, callback) {
        self.derive((err, seedSSI) => {
            if (err) {
                return callback(err);
            }

            seedSSI.sign(dataToSign, callback);
        })
    }

    self.getPublicKey = function (format) {
        return cryptoRegistry.getDerivePublicKeyFunction(self)(self.getPrivateKey(), format);
    }

    self.getEncryptionKey = function (callback) {
        self.derive((err, seedSSI) => {
            if (err) {
                return callback(err);
            }

            seedSSI.getEncryptionKey(callback);
        })
    };

    self.getKeyPair = function () {
        const keyPair = {
            privateKey: self.getPrivateKey("pem"),
            publicKey: self.getPublicKey("pem")
        }

        return keyPair;
    }

    self.getFamilyName = () => {
        return SSIFamilies.SEED_SSI_FAMILY;
    }

    function toString(buf) {
        let MAX_ARGUMENTS_LENGTH = 0x1000

        function decodeCodePointsArray(codePoints) {
            let len = codePoints.length
            if (len <= MAX_ARGUMENTS_LENGTH) {
                return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
            }

            // Decode in chunks to avoid "call stack size exceeded".
            let res = ''
            let i = 0
            while (i < len) {
                res += String.fromCharCode.apply(
                    String,
                    codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
                )
            }
            return res
        }

        let start = 0;
        let end = buf.length;
        let res = []

        let i = start
        while (i < end) {
            let firstByte = buf[i]
            let codePoint = null
            let bytesPerSequence = (firstByte > 0xEF) ? 4
                : (firstByte > 0xDF) ? 3
                    : (firstByte > 0xBF) ? 2
                        : 1

            if (i + bytesPerSequence <= end) {
                let secondByte, thirdByte, fourthByte, tempCodePoint

                switch (bytesPerSequence) {
                    case 1:
                        if (firstByte < 0x80) {
                            codePoint = firstByte
                        }
                        break
                    case 2:
                        secondByte = buf[i + 1]
                        if ((secondByte & 0xC0) === 0x80) {
                            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
                            if (tempCodePoint > 0x7F) {
                                codePoint = tempCodePoint
                            }
                        }
                        break
                    case 3:
                        secondByte = buf[i + 1]
                        thirdByte = buf[i + 2]
                        if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
                            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
                            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
                                codePoint = tempCodePoint
                            }
                        }
                        break
                    case 4:
                        secondByte = buf[i + 1]
                        thirdByte = buf[i + 2]
                        fourthByte = buf[i + 3]
                        if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
                            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
                            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
                                codePoint = tempCodePoint
                            }
                        }
                }
            }

            if (codePoint === null) {
                // we did not generate a valid codePoint so insert a
                // replacement char (U+FFFD) and advance only 1 byte
                codePoint = 0xFFFD
                bytesPerSequence = 1
            } else if (codePoint > 0xFFFF) {
                // encode to utf16 (surrogate pair dance)
                codePoint -= 0x10000
                res.push(codePoint >>> 10 & 0x3FF | 0xD800)
                codePoint = 0xDC00 | codePoint & 0x3FF
            }

            res.push(codePoint)
            i += bytesPerSequence
        }

        return decodeCodePointsArray(res)
    }
}

function createPathKeySSI(enclave, identifier) {
    return new PathKeySSI(enclave, identifier);
}

module.exports = {
    createPathKeySSI
};
