const {decode: decodeBase64URL, encodeBase64, decodeBase64} = require('../runtime/base64url.js');
const {fromSPKI: importPublic} = require('../runtime/asn1.js');
const {fromPKCS8: importPrivate} = require('../runtime/asn1.js');
const asKeyObject = require('../runtime/jwk_to_key.js');
const {JOSENotSupported} = require('../util/errors.js');
const formatPEM = require('../lib/format_pem.js');
const isObject = require('../lib/is_object.js');

function getElement(seq) {
    let result = [];
    let next = 0;
    while (next < seq.length) {
        let nextPart = parseElement(seq.subarray(next));
        result.push(nextPart);
        next += nextPart.byteLength;
    }
    return result;
}

function parseElement(bytes) {
    let position = 0;
    let tag = bytes[0] & 0x1f;
    position++;
    if (tag === 0x1f) {
        tag = 0;
        while (bytes[position] >= 0x80) {
            tag = tag * 128 + bytes[position] - 0x80;
            position++;
        }
        position++;
    }
    let length;
    if (bytes[position] < 0x80) {
        length = bytes[position];
        position++;
    } else {
        let numberOfDigits = bytes[position] & 0x7f;
        position++;
        length = 0;
        for (let i = 0; i < numberOfDigits; i++) {
            length = length * 256 + bytes[position];
            position++;
        }
    }
    if (length === 0x80) {
        length = 0;
        while (bytes[position + length] !== 0 || bytes[position + length + 1] !== 0) {
            length++;
        }
        const byteLength = position + length + 2;
        return {
            byteLength,
            contents: bytes.subarray(position, position + length),
            raw: bytes.subarray(0, byteLength),
        };
    }
    const byteLength = position + length;
    return {
        byteLength,
        contents: bytes.subarray(position, byteLength),
        raw: bytes.subarray(0, byteLength),
    };
}

function spkiFromX509(buf) {
    return encodeBase64(getElement(getElement(parseElement(buf).contents)[0].contents)[6].raw);
}

function getSPKI(x509) {
    const pem = x509.replace(/-----(?:BEGIN|END) CERTIFICATE-----|\s/g, '');
    const raw = decodeBase64(pem);
    return formatPEM(spkiFromX509(raw), 'PUBLIC KEY');
}

async function importSPKI(spki, alg, options) {
    if (typeof spki !== 'string' || spki.indexOf('-----BEGIN PUBLIC KEY-----') !== 0) {
        throw new TypeError('"spki" must be SPKI formatted string');
    }
    return importPublic(spki, alg, options);
}

async function importX509(x509, alg, options) {
    if (typeof x509 !== 'string' || x509.indexOf('-----BEGIN CERTIFICATE-----') !== 0) {
        throw new TypeError('"x509" must be X.509 formatted string');
    }
    const spki = getSPKI(x509);
    return importPublic(spki, alg, options);
}

async function importPKCS8(pkcs8, alg, options) {
    if (typeof pkcs8 !== 'string' || pkcs8.indexOf('-----BEGIN PRIVATE KEY-----') !== 0) {
        throw new TypeError('"pkcs8" must be PCKS8 formatted string');
    }
    return importPrivate(pkcs8, alg, options);
}

async function importJWK(jwk, alg, octAsKeyObject) {
    if (!isObject(jwk)) {
        throw new TypeError('JWK must be an object');
    }
    alg = alg || jwk.alg;
    if (typeof alg !== 'string' || !alg) {
        throw new TypeError('"alg" argument is required when "jwk.alg" is not present');
    }
    switch (jwk.kty) {
        case 'oct':
            if (typeof jwk.k !== 'string' || !jwk.k) {
                throw new TypeError('missing "k" (Key Value) Parameter value');
            }
            octAsKeyObject = octAsKeyObject !== null && octAsKeyObject !== void 0 ? octAsKeyObject : (jwk.ext !== true);
            if (octAsKeyObject) {
                return asKeyObject({...jwk, alg, ext: false});
            }
            return decodeBase64URL(jwk.k);
        case 'RSA':
            if (jwk.oth !== undefined) {
                throw new JOSENotSupported('RSA JWK "oth" (Other Primes Info) Parameter value is not supported');
            }
        case 'EC':
        case 'OKP':
            return asKeyObject({...jwk, alg});
        default:
            throw new JOSENotSupported('Unsupported "kty" (Key Type) Parameter value');
    }
}

module.exports = {
    importSPKI,
    importX509,
    importPKCS8,
    importJWK
}