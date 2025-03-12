const ecies = require('../ecies-doa-ds')
const crypto = require('crypto')
const curveName = require('../config').curveName;


const NS_PER_SEC = 1e9;
const msgNo = 500
const msgSize = 100

// Generate an array of random messages
const msgArray = new Array(msgNo)
for (let i = 0; i < msgNo; ++i) {
    msgArray[i] = crypto.pseudoRandomBytes(msgSize)
}
const encArray = new Array(msgNo)

// Generate Alice's EC signing key pair
let aliceECSigningKeyPair = crypto.generateKeyPairSync(
    'ec',
    {
        namedCurve: curveName
    }
)
let bobECDH = crypto.createECDH(curveName)
let bobECDHPublicKey = bobECDH.generateKeys();
let bobECDHPrivateKey = bobECDH.getPrivateKey();

// Start with encyptions
let startTime = process.hrtime();
for (let i = 0; i < msgNo; ++i) {
    encArray[i] = ecies.encrypt(aliceECSigningKeyPair, bobECDHPublicKey, msgArray[i])
}
let totalHRTime = process.hrtime(startTime);
const encTimeSecs = (totalHRTime[0] * NS_PER_SEC + totalHRTime[1]) / NS_PER_SEC

// Do decryptions now
startTime = process.hrtime();
for (let i = 0; i < msgNo; ++i) {
    ecies.decrypt(bobECDHPrivateKey, encArray[i])
}
totalHRTime = process.hrtime(startTime);
const decTimeSecs = (totalHRTime[0] * NS_PER_SEC + totalHRTime[1]) / NS_PER_SEC

console.log("ECIES-DOA-DS Benchmark Inputs: " + msgNo + " messages, message_size = " + msgSize + " bytes")
console.log("Encryption benchmark results: total_time = " + encTimeSecs + " (secs), throughput = " + (msgNo / encTimeSecs) + " (ops/sec), Avg_Op_Time = " + (encTimeSecs / msgNo) + " (secs)")
console.log("Decryption benchmark results: total_time = " + decTimeSecs + " (secs), throughput = " + (msgNo / decTimeSecs) + " (ops/sec), Avg_Op_Time = " + (decTimeSecs / msgNo) + " (secs)")


