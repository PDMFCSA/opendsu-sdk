const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE_MAP = {};
for (let i = 0; i < ALPHABET.length; i++) {
    BASE_MAP[ALPHABET[i]] = i;
}

function encodeBase64(data) {
    if (!Buffer.isBuffer(data)) {
        data = Buffer.from(data);
    }

    return data.toString("base64");
}

function decodeBase64(data) {
    if (!Buffer.isBuffer(data)) {
        data = Buffer.from(data);
    }

    return Buffer.from(data.toString(), "base64");
}

module.exports = {
    encode: encodeBase64,
    decode: decodeBase64
}