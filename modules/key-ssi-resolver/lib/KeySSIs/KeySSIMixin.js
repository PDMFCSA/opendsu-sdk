const cryptoRegistry = require("../CryptoAlgorithms/CryptoAlgorithmsRegistry");
const pskCrypto = require("pskcrypto");
const SSITypes = require("./SSITypes");
const Hint = require("./Hint");
const MAX_KEYSSI_LENGTH = 2048

function keySSIMixin(target, enclave) {
    let _prefix = "ssi";
    let _subtype;
    let _dlDomain;
    let _subtypeSpecificString;
    let _controlString;
    let _vn = "v0";
    let _hint;
    let _canSign = false;

    const _createHint = (hintSerialisation) => {
        if (_hint instanceof Hint) {
            return;
        }

        _hint = new Hint(hintSerialisation);
    }

    target.autoLoad = function (identifier) {
        if (typeof identifier === "undefined") {
            return;
        }

        if (typeof identifier !== "string") {
            throw new Error("The identifier should be string");
        }

        target.validateKeySSICharLength();

        let originalId = identifier;
        if (identifier.indexOf(":") === -1) {
            identifier = pskCrypto.pskBase58Decode(identifier).toString();
        }

        if (identifier.indexOf(":") === -1) {
            throw new Error(`Wrong format of SSI. ${originalId} ${identifier}`);
        }

        let segments = identifier.split(":");
        segments.shift();
        _subtype = segments.shift();
        _dlDomain = segments.shift();
        _subtypeSpecificString = segments.shift();
        _controlString = segments.shift();
        let version = segments.shift();
        if (version !== '') {
            _vn = version;
        }
        if (segments.length > 0) {
            _hint = segments.join(":");
            _createHint(_hint);
        }

        // _subtypeSpecificString = cryptoRegistry.getDecodingFunction(target)(_subtypeSpecificString);
    }

    target.validateKeySSICharLength = () => {
        if (target.getIdentifier() > MAX_KEYSSI_LENGTH) {
            throw new Error(`The identifier length exceed maximum char length ${MAX_KEYSSI_LENGTH}`);
        }
    }

    target.load = function (subtype, dlDomain, subtypeSpecificString, control, vn, hint) {
        _subtype = subtype;
        _dlDomain = dlDomain;
        _subtypeSpecificString = subtypeSpecificString;
        _controlString = control || '';
        _vn = vn || "v0";
        _hint = hint;

        if (_hint) {
            _createHint(_hint)
        }
        target.validateKeySSICharLength();
    }

    /**
     *
     * @param ssiType - string
     * @param callback - function
     */
    target.getDerivedType = function (ssiType, callback) {
        const KeySSIFactory = require("./KeySSIFactory");
        KeySSIFactory.getDerivedType(target, ssiType, callback);
    }

    target.getRelatedType = function (ssiType, callback) {
        console.log(".getRelatedType function is obsolete. Use .getDerivedType instead.");
        target.getDerivedType(ssiType, callback);
    }

    target.getRootKeySSITypeName = function () {
        const KeySSIFactory = require("./KeySSIFactory");
        return KeySSIFactory.getRootKeySSITypeName(target);
    }

    target.getAnchorIdAsync = function (plain) {
        return new Promise((resolve, reject) => {
            if (typeof plain === "undefined") {
                plain = false;
            }
            target.getAnchorId(plain, (err, anchorId) => {
                if (err) {
                    return reject(err);
                }
                resolve(anchorId);
            })
        });
    }

    target.getAnchorIdSync = (plain) => {
        const keySSIFactory = require("./KeySSIFactory");
        return keySSIFactory.getAnchorTypeSync(target).getNoHintIdentifier(plain);
    }

    target.getAnchorId = function (plain, callback) {
        if (typeof plain === "function") {
            callback = plain;
            plain = false;
        }
        const keySSIFactory = require("./KeySSIFactory");
        keySSIFactory.getAnchorType(target, (err, anchorSSI) => {
            if (err) {
                return callback(err);
            }

            callback(undefined, anchorSSI.getNoHintIdentifier(plain));
        })
    }

    target.getSpecificString = function () {
        return _subtypeSpecificString;
    }

    target.getName = function () {
        console.trace("Obsolete function. Replace with getTypeName");
        return _subtype;
    }

    target.getTypeName = function () {
        return _subtype;
    }

    target.getDLDomain = function () {
        if (_dlDomain === '' || typeof _dlDomain === "undefined") {
            return undefined;
        }

        if (_dlDomain.startsWith("$")) {
            return process.env[_dlDomain.slice(1)];
        }

        return _dlDomain;
    }

    target.getControlString = function () {
        return _controlString || '';
    }

    target.getHint = function () {
        return _hint;
    }

    target.getVn = function () {
        return _vn;
    }

    target.getDSURepresentationName = function () {
        const DSURepresentationNames = require("./DSURepresentationNames");
        return DSURepresentationNames[_subtype];
    }

    target.getNoHintIdentifier = function (plain) {
        const dlDomain = target.getDLDomain() || '';
        const specificString = target.getSpecificString() || '';
        const controlString = target.getControlString() || '';
        let identifier = `${_prefix}:${target.getTypeName()}:${dlDomain}:${specificString}:${controlString}:${target.getVn()}`;
        return plain ? identifier : pskCrypto.pskBase58Encode(identifier);
    }

    target.getIdentifier = function (plain) {
        let id = target.getNoHintIdentifier(true);

        if (typeof _hint !== "undefined") {
            id += ":" + _hint.getSerialisation();
        }

        return plain ? id : pskCrypto.pskBase58Encode(id);
    }

    target.getBricksDomain = function () {
        let bricksDomain
        try {
            bricksDomain = _hint.getBricksDomain();
        } catch (e) {

        }
        return bricksDomain ? bricksDomain : _dlDomain;
    }

    target.getDSUVersionHint = function () {
        if (typeof _hint !== "undefined") {
            return _hint.getDSUVersion();
        }

        return undefined;
    }

    target.setDSUVersionHint = function (version) {
        if (typeof _hint === "undefined") {
            _createHint();
        }

        _hint.setDSUVersion(version);
    }

    target.setEmbeddedData = function (embeddedData) {
        if (typeof _hint === "undefined") {
            _createHint();
        }

        _hint.setEmbeddedData(embeddedData);
    }

    target.getEmbeddedData = function () {
        if (typeof _hint === "undefined") {
            return;
        }

        return _hint.getEmbeddedData();
    }

    target.clone = function () {
        let clone = {};
        clone.prototype = target.prototype;
        for (let attr in target) {
            if (target.hasOwnProperty(attr)) {
                clone[attr] = target[attr];
            }
        }
        keySSIMixin(clone);
        return clone;
    }

    /*
    * This method is meant to be used in order to cast between similar types of SSIs
    * e.g. WalletSSI to ArraySSI
    *
    * */
    target.cast = function (newType) {
        target.getTypeName = () => {
            return newType;
        };
        target.load(newType, _dlDomain, _subtypeSpecificString, _controlString, _vn, _hint);
    }

    target.canSign = () => {
        return _canSign;
    }

    target.setCanSign = (canSign) => {
        _canSign = canSign;
    }

    target.canBeVerified = () => {
        return false;
    };

    target.sign = (dataToSign, callback) => {
        if (typeof enclave !== "undefined") {
            return enclave.signForKeySSI(undefined, target, dataToSign, callback);
        }
        const sc = require("opendsu").loadAPI("sc").getSecurityContext();
        sc.signForKeySSI(undefined, target, dataToSign, callback);
    };

    target.verify = (data, signature) => {
        const decode = cryptoRegistry.getBase64DecodingFunction(target);
        signature = decode(signature);
        const verify = cryptoRegistry.getVerifyFunction(target);

        return verify(data, target.getPublicKey(), signature);
    };

    target.hash = (data) => {
        return cryptoRegistry.getHashFunction(target)(data);
    }

    target.encode = (data) => {
        return cryptoRegistry.getEncodingFunction(target)(data);
    }

    target.decode = (data) => {
        return cryptoRegistry.getDecodingFunction(target)(data);
    }

    target.base64Encode = (data) => {
        return cryptoRegistry.getBase64EncodingFunction(target)(data);
    }

    target.base64Decode = (data) => {
        return cryptoRegistry.getBase64DecodingFunction(target)(data);
    }

    target.toJSON = function () {
        return target.getIdentifier();
    }

    target.canAppend = function () {
        return true;
    }

    target.isTransfer = function () {
        return false;
    }

    target.isAlias = function () {
        return false;
    }

    target.isEmbed = function () {
        return false;
    }

    target.withoutCryptoData = function () {
        if (!_subtypeSpecificString && !_controlString) {
            return true;
        }

        return false;
    }

    target.createAnchorValue = function (brickMapHash, previousAnchorValue, callback) {
        const keySSIFactory = require("./KeySSIFactory");

        const signedHashLinkSSI = keySSIFactory.createType(SSITypes.SIGNED_HASH_LINK_SSI);
        target.getAnchorId(true, (err, anchorId) => {
            if (err) {
                return callback(err);
            }
            if (typeof previousAnchorValue === "string") {
                previousAnchorValue = keySSIFactory.create(previousAnchorValue);
            }

            let previousIdentifier = '';
            let timestamp = Date.now();
            if (previousAnchorValue && typeof previousAnchorValue.getTimestamp === "function" && timestamp < previousAnchorValue.getTimestamp()) {
                timestamp = previousAnchorValue.getTimestamp() + 10000;
            }
            if (previousAnchorValue) {
                previousIdentifier = previousAnchorValue.getIdentifier(true);
            }
            let dataToSign = anchorId + brickMapHash + previousIdentifier + timestamp;
            target.sign(dataToSign, (err, signature) => {
                if (err) {
                    return callback(err);
                }

                signedHashLinkSSI.initialize(target.getBricksDomain(), brickMapHash, timestamp, signature, target.getVn(), target.getHint());
                callback(undefined, signedHashLinkSSI);
            })
        })
    }

    target.getFamilyName = () => {
        return undefined
    }

    return target;
}

module.exports = keySSIMixin;
