const ecies = require('../ecies-doa-kmac')
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


let aliceECDH = crypto.createECDH(curveName)
let aliceECDHPublicKey = aliceECDH.generateKeys();
let aliceECDHPrivateKey = aliceECDH.getPrivateKey();
let aliceECDHKeyPair = {
    publicKey: aliceECDHPublicKey,
    privateKey: aliceECDHPrivateKey
}
let bobECDH = crypto.createECDH(curveName)
let bobECDHPublicKey = bobECDH.generateKeys();
let bobECDHPrivateKey = bobECDH.getPrivateKey();

// Start with encyptions
let startTime = process.hrtime();
for (let i = 0; i < msgNo; ++i) {
    encArray[i] = ecies.encrypt(aliceECDHKeyPair, bobECDHPublicKey, msgArray[i])
}
let totalHRTime = process.hrtime(startTime);
let encTimeSecs = (totalHRTime[0] * NS_PER_SEC + totalHRTime[1]) / NS_PER_SEC

// Do decryptions now
startTime = process.hrtime();
for (let i = 0; i < msgNo; ++i) {
    ecies.decrypt(bobECDHPrivateKey, encArray[i])
}
totalHRTime = process.hrtime(startTime);
let decTimeSecs = (totalHRTime[0] * NS_PER_SEC + totalHRTime[1]) / NS_PER_SEC

console.log("ECIES-DOA-KMAC Benchmark Inputs: " + msgNo + " messages, message_size = " + msgSize + " bytes")
console.log("Encryption benchmark results: total_time = " + encTimeSecs + " (secs), throughput = " + (msgNo / encTimeSecs) + " (ops/sec), Avg_Op_Time = " + (encTimeSecs / msgNo) + " (secs)")
console.log("Decryption benchmark results: total_time = " + decTimeSecs + " (secs), throughput = " + (msgNo / decTimeSecs) + " (ops/sec), Avg_Op_Time = " + (decTimeSecs / msgNo) + " (secs)")


