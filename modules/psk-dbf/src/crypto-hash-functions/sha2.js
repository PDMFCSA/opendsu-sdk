const crypto = require("crypto");

function linearFowlerNollVoJenkinsHashFunction(data, index, options) {
    const {cryptoSecret, bitCount} = options;

    const cryptoHash = crypto.createHash("sha256", cryptoSecret).update(data).digest().readUInt32BE();
    return ((index + 1) * cryptoHash) % bitCount;
}

module.exports = linearFowlerNollVoJenkinsHashFunction;
