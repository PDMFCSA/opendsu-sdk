const {compactVerify} = require('../jws/compact/verify.js');
const jwtPayload = require('../lib/jwt_claims_set.js');
const {JWTInvalid} = require('../util/errors.js');
module.exports.jwtVerify = async function jwtVerify(jwt, key, options) {
    let _a;
    const verified = await compactVerify(jwt, key, options);
    if (((_a = verified.protectedHeader.crit) === null || _a === void 0 ? void 0 : _a.includes('b64')) && verified.protectedHeader.b64 === false) {
        throw new JWTInvalid('JWTs MUST NOT use unencoded payload');
    }
    const payload = jwtPayload(verified.protectedHeader, verified.payload, options);
    const result = {payload, protectedHeader: verified.protectedHeader};
    if (typeof key === 'function') {
        return {...result, key: verified.key};
    }
    return result;
}
