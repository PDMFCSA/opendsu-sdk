/*
 SignSens helper functions
 */
exports.wipeOutsidePayload = function wipeOutsidePayload(hashStringHexa, pos, size) {
    let result;
    let sz = hashStringHexa.length;

    let end = (pos + size) % sz;

    if (pos < end) {
        result = '0'.repeat(pos) + hashStringHexa.substring(pos, end) + '0'.repeat(sz - end);
    } else {
        result = hashStringHexa.substring(0, end) + '0'.repeat(pos - end) + hashStringHexa.substring(pos, sz);
    }
    return result;
}


exports.extractPayload = function extractPayload(hashStringHexa, pos, size) {
    let result;

    let sz = hashStringHexa.length;
    let end = (pos + size) % sz;

    if (pos < end) {
        result = hashStringHexa.substring(pos, pos + size);
    } else {

        if (0 !== end) {
            result = hashStringHexa.substring(0, end)
        } else {
            result = "";
        }
        result += hashStringHexa.substring(pos, sz);
    }
    return result;
}


exports.fillPayload = function fillPayload(payload, pos, size) {
    let sz = 64;
    let result;

    let end = (pos + size) % sz;

    if (pos < end) {
        result = '0'.repeat(pos) + payload + '0'.repeat(sz - end);
    } else {
        result = payload.substring(0, end);
        result += '0'.repeat(pos - end);
        result += payload.substring(end);
    }
    return result;
}


exports.generatePosHashXTimes = function generatePosHashXTimes(buffer, pos, size, count) { //generate positional hash
    let result = buffer.toString("hex");

    /*if(pos != -1 )
        result[pos] = 0; */
    const crypto = require('crypto');
    for (let i = 0; i < count; i++) {
        let hash = crypto.createHash('sha256');
        result = exports.wipeOutsidePayload(result, pos, size);
        hash.update(result);
        result = hash.digest('hex');
    }
    return exports.wipeOutsidePayload(result, pos, size);
}

exports.hashStringArray = function (counter, arr, payloadSize) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    let result = counter.toString(16);

    for (let i = 0; i < 64; i++) {
        result += exports.extractPayload(arr[i], i, payloadSize);
    }

    hash.update(result);
    result = hash.digest('hex');
    return result;
}


function dumpMember(obj) {
    let type = Array.isArray(obj) ? "array" : typeof obj;
    if (obj === null) {
        return "null";
    }
    if (obj === undefined) {
        return "undefined";
    }

    switch (type) {
        case "number":
        case "string":
            return obj.toString();
        case "object":
            return exports.dumpObjectForHashing(obj);
        case "boolean":
            return obj ? "true" : "false";
        case "array":
            let result = "";
            for (let i = 0; i < obj.length; i++) {
                result += exports.dumpObjectForHashing(obj[i]);
            }
            return result;
        default:
            throw new Error("Type " + type + " cannot be cryptographically digested");
    }

}


exports.dumpObjectForHashing = function (obj) {
    let result = "";

    if (obj === null) {
        return "null";
    }
    if (obj === undefined) {
        return "undefined";
    }

    let basicTypes = {
        "array": true,
        "number": true,
        "boolean": true,
        "string": true,
        "object": false
    }

    let type = Array.isArray(obj) ? "array" : typeof obj;
    if (basicTypes[type]) {
        return dumpMember(obj);
    }

    let keys = Object.keys(obj);
    keys.sort();


    for (let i = 0; i < keys.length; i++) {
        result += dumpMember(keys[i]);
        result += dumpMember(obj[keys[i]]);
    }

    return result;
}


exports.hashValues = function (values) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    let result = exports.dumpObjectForHashing(values);
    hash.update(result);
    return hash.digest('hex');
};

exports.getJSONFromSignature = function getJSONFromSignature(signature, size) {
    let result = {
        proof: []
    };
    let a = signature.split(":");
    result.agent = a[0];
    result.counter = parseInt(a[1]);
    result.nextPublic = a[2];

    let proof = a[3]


    if (proof.length / size !== 64) {
        throw new Error("Invalid signature " + proof);
    }

    for (let i = 0; i < 64; i++) {
        result.proof.push(exports.fillPayload(proof.substring(i * size, (i + 1) * size), i, size))
    }

    return result;
}

exports.createSignature = function (agent, counter, nextPublic, arr, size) {
    let result = "";

    for (let i = 0; i < arr.length; i++) {
        result += exports.extractPayload(arr[i], i, size);
    }

    return agent + ":" + counter + ":" + nextPublic + ":" + result;
}