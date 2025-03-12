const crypto = require('crypto')
const mycrypto = require('../crypto')
const config = require('../config')

const NS_PER_SEC = 1e9;
const iterations = 1000

let message = crypto.pseudoRandomBytes(32)

let aliceECDH = crypto.createECDH(config.curveName)
aliceECDH.generateKeys()
let aliceECDHPrivateKey = aliceECDH.getPrivateKey()
let aliceECSigningKeyPair = crypto.generateKeyPairSync(
    'ec',
    {
        namedCurve: config.curveName
    }
)
// Generate Bob's ECDH key pair (message receiver)
let bobECDH = crypto.createECDH(config.curveName)
let bobECDHPublicKey = bobECDH.generateKeys();

let startTime = process.hrtime();
for (let i = 0; i < iterations; ++i) {
    let ephemeralKA = new mycrypto.ECEphemeralKeyAgreement()
    ephemeralKA.computeSharedSecretFromKeyPair(aliceECDHPrivateKey, bobECDHPublicKey)
}
let totalHRTime = process.hrtime(startTime);
let ecdhTimeSecs = (totalHRTime[0] * NS_PER_SEC + totalHRTime[1]) / NS_PER_SEC

startTime = process.hrtime();
for (let i = 0; i < iterations; ++i) {
    mycrypto.computeDigitalSignature(aliceECSigningKeyPair.privateKey, message, config)
}
totalHRTime = process.hrtime(startTime);
let ecdsaTimeSecs = (totalHRTime[0] * NS_PER_SEC + totalHRTime[1]) / NS_PER_SEC

console.log("ECDH Derive Shared Secret vs ECDSA Performance Comparison: " + iterations + " iterations")
console.log("ECDH Derive Shared Secret benchmark results: total_time = " + ecdhTimeSecs + " (secs), throughput = " + (iterations / ecdhTimeSecs) + " (ops/sec), Avg_Op_Time = " + (ecdhTimeSecs / iterations) + " (secs)")
console.log("ECDSA benchmark results: total_time = " + ecdsaTimeSecs + " (secs), throughput = " + (iterations / ecdsaTimeSecs) + " (ops/sec), Avg_Op_Time = " + (ecdsaTimeSecs / iterations) + " (secs)")
