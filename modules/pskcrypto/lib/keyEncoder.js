const asn1 = require('./asn1/asn1');
const BN = require('./asn1/bignum/bn');

const ECPrivateKeyASN = asn1.define('ECPrivateKey', function () {
    this.seq().obj(this.key('version').int(), this.key('privateKey').octstr(), this.key('parameters').explicit(0).objid().optional(), this.key('publicKey').explicit(1).bitstr().optional())
})

const SubjectPublicKeyInfoASN = asn1.define('SubjectPublicKeyInfo', function () {
    this.seq().obj(this.key('algorithm').seq().obj(this.key("id").objid(), this.key("curve").objid()), this.key('pub').bitstr())
})

const ECDSASignature = asn1.define('ECDSASignature', function () {
    return this.seq().obj(this.key('r').int(), this.key('s').int());
});

const curves = {
    secp256k1: {
        curveParameters: [1, 3, 132, 0, 10],
        privatePEMOptions: {label: 'EC PRIVATE KEY'},
        publicPEMOptions: {label: 'PUBLIC KEY'}
    }
}

function assert(val, msg) {
    if (!val) {
        throw new Error(msg || 'Assertion failed')
    }
}

function KeyEncoder(options) {
    if (typeof options === 'string') {
        assert(curves.hasOwnProperty(options), 'Unknown curve ' + options);
        options = curves[options]
    }
    this.options = options;
    this.algorithmID = [1, 2, 840, 10045, 2, 1]
}

KeyEncoder.ECPrivateKeyASN = ECPrivateKeyASN;
KeyEncoder.SubjectPublicKeyInfoASN = SubjectPublicKeyInfoASN;
KeyEncoder.ECDSASignature = ECDSASignature;

KeyEncoder.prototype.privateKeyObject = function (rawPrivateKey, rawPublicKey, encodingFormat = "hex") {
    const privateKeyObject = {
        version: new BN(1),
        privateKey: $$.Buffer.from(rawPrivateKey, encodingFormat),
        parameters: this.options.curveParameters,
        pemOptions: {label: "EC PRIVATE KEY"}
    };

    if (rawPublicKey) {
        privateKeyObject.publicKey = {
            unused: 0, data: $$.Buffer.from(rawPublicKey, encodingFormat)
        }
    }

    return privateKeyObject
};

KeyEncoder.prototype.publicKeyObject = function (rawPublicKey) {
    return {
        algorithm: {
            id: this.algorithmID, curve: this.options.curveParameters
        }, pub: {
            unused: 0, data: rawPublicKey
        }, pemOptions: {label: "PUBLIC KEY"}
    }
}

KeyEncoder.prototype.encodePrivate = function (privateKey, originalFormat, destinationFormat, encodingFormat = "hex") {
    let privateKeyObject;

    /* Parse the incoming private key and convert it to a private key object */
    if (originalFormat === 'raw') {
        if (!$$.Buffer.isBuffer(privateKey)) {
            throw Error('private key must be a buffer');
        }
    } else if (originalFormat === 'der') {
        if ($$.Buffer.isBuffer(privateKey)) {
            // do nothing
        } else if (typeof privateKey === 'string') {
            privateKey = $$.Buffer.from(privateKey, encodingFormat);
        } else {
            throw Error('private key must be a buffer or a string');
        }
        privateKeyObject = ECPrivateKeyASN.decode(privateKey, 'der')
    } else if (originalFormat === 'pem') {
        if (typeof privateKey !== 'string') {
            throw Error('private key must be a string');
        }
        privateKeyObject = ECPrivateKeyASN.decode(privateKey, 'pem', this.options.privatePEMOptions)
    } else {
        throw Error('invalid private key format');
    }

    /* Export the private key object to the desired format */
    if (destinationFormat === 'raw') {
        return privateKeyObject.privateKey;
    } else if (destinationFormat === 'der') {
        return ECPrivateKeyASN.encode(privateKeyObject, 'der').toString(encodingFormat)
    } else if (destinationFormat === 'pem') {
        return ECPrivateKeyASN.encode(privateKeyObject, 'pem', this.options.privatePEMOptions)
    } else {
        throw Error('invalid destination format for private key');
    }
}

KeyEncoder.prototype.encodePublic = function (publicKey, originalFormat, destinationFormat, encodingFormat = "hex") {
    let publicKeyObject;

    /* Parse the incoming public key and convert it to a public key object */
    if (originalFormat === 'raw') {
        if (!$$.Buffer.isBuffer(publicKey)) {
            throw Error('public key must be a buffer');
        }
        publicKeyObject = this.publicKeyObject(publicKey)
    } else if (originalFormat === 'der') {
        if ($$.Buffer.isBuffer(publicKey)) {
            // do nothing
        } else if (typeof publicKey === 'string') {
            publicKey = $$.Buffer.from(publicKey, encodingFormat)
        } else {
            throw Error('public key must be a buffer or a string');
        }
        publicKeyObject = SubjectPublicKeyInfoASN.decode(publicKey, 'der')
    } else if (originalFormat === 'pem') {
        if (typeof publicKey !== 'string') {
            throw Error('public key must be a string');
        }
        publicKeyObject = SubjectPublicKeyInfoASN.decode(publicKey, 'pem', this.options.publicPEMOptions)
    } else {
        throw Error('invalid public key format');
    }

    /* Export the private key object to the desired format */
    if (destinationFormat === 'raw') {
        return publicKeyObject.pub.data;
    } else if (destinationFormat === 'der') {
        return SubjectPublicKeyInfoASN.encode(publicKeyObject, 'der').toString(encodingFormat)
    } else if (destinationFormat === 'pem') {
        return SubjectPublicKeyInfoASN.encode(publicKeyObject, 'pem', this.options.publicPEMOptions)
    } else {
        throw Error('invalid destination format for public key');
    }
}

module.exports = KeyEncoder;
