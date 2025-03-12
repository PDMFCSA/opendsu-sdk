const crypto = require('crypto');
const ssutil = require("./ssutil");


function SignsensusSignatureChain(agent, PROOF_BLOCK_SIZE, loader) {

    if (!PROOF_BLOCK_SIZE) {
        PROOF_BLOCK_SIZE = 32;
    }

    if (loader) {
        console.log("Loading previous signatures is not implemented yet. Starting from 0 for testing");
    }

    let counter = 0;
    let signatureIndex = [];


    function generatePublicAndPrivateKeys(myCounter) {


        let result = {}
        result.private = $$.Buffer.alloc(32);
        crypto.randomFillSync(result.private);

        let proof = [];
        for (let i = 0; i < 64; i++) {
            proof.push(ssutil.generatePosHashXTimes(result.private, i, PROOF_BLOCK_SIZE, 256)); //not 255 to not discolose much about the private key for digests with 0 in bytes
        }

        result.public = ssutil.hashStringArray(myCounter, proof, PROOF_BLOCK_SIZE);
        //console.log("Public key", myCounter, " :", result.public);

        return result;
    }

    signatureIndex.push(generatePublicAndPrivateKeys(counter));

    function computeHashes(digest, nextPublic, verificationMode, startFrom) {

        let digestForSigning = [digest, nextPublic];


        digest = ssutil.hashValues(digestForSigning);
        const directDigest = $$.Buffer.from(digest, 'hex');
        const nonDigest = $$.Buffer.alloc(32);
        for (let i = 0; i < 32; i++) {
            nonDigest[i] = 255 - directDigest[i];
        }

        let proof = [];
        let jumps;
        let debugInfo = [];

        for (let i = 0; i < 32; i++) {
            if (!verificationMode) {
                jumps = directDigest[i] + 1;
                proof.push(ssutil.generatePosHashXTimes(startFrom.private, i, PROOF_BLOCK_SIZE, jumps));
                debugInfo.push(jumps);
            } else { //verification mode
                jumps = 255 - directDigest[i];
                proof.push(ssutil.generatePosHashXTimes(startFrom[i], i, PROOF_BLOCK_SIZE, jumps));
                debugInfo.push(jumps);
            }
            //console.log(proof[proof.length -1]);
        }

        for (let i = 0; i < 32; i++) {
            if (!verificationMode) {
                jumps = nonDigest[i] + 1;
                proof.push(ssutil.generatePosHashXTimes(startFrom.private, i + 32, PROOF_BLOCK_SIZE, jumps));
                debugInfo.push(jumps);
            } else { //verification mode
                jumps = 255 - nonDigest[i];
                proof.push(ssutil.generatePosHashXTimes(startFrom[i + 32], i + 32, PROOF_BLOCK_SIZE, jumps));
                debugInfo.push(jumps);
            }
            //console.log(proof[proof.length -1]);
        }

        //console.log("Debug:", debugInfo.join(" "));
        return proof;
    }

    this.sign = function (digest) {

        let current = signatureIndex[counter];

        let next = generatePublicAndPrivateKeys(counter + 1);
        signatureIndex.push(next);

        let proof = computeHashes(digest, next.public, false, current)

        counter++;
        return ssutil.createSignature(agent, counter - 1, next.public, proof, PROOF_BLOCK_SIZE);
    }


    this.verify = function (digest, signature) {

        let signJSON = ssutil.getJSONFromSignature(signature, PROOF_BLOCK_SIZE);

        let current = signatureIndex[signJSON.counter];
        let next = signatureIndex[signJSON.counter + 1];

        //console.log(signJSON);

        if (signJSON.nextPublic != next.public) {
            console.log("Found a signature with a fake next public!!!")
            return false;
        } // fake signature

        let proof = computeHashes(digest, next.public, true, signJSON.proof);


        let publicFromSignature = ssutil.hashStringArray(signJSON.counter, proof, PROOF_BLOCK_SIZE);

        //console.log(publicFromSignature, current.public)
        if (publicFromSignature == current.public) {
            return true;
        } else {
            return false;
        }
    }
}


function AgentSafeBox(agentName, blockSize) {

    let agentHash = ssutil.hashValues(agentName)
    let chain = new SignsensusSignatureChain(agentHash, blockSize);


    this.digest = function (obj) {
        let result = ssutil.dumpObjectForHashing(obj);
        let hash = crypto.createHash('sha256');
        hash.update(result);
        return hash.digest('hex');
    }

    this.sign = function (digest, calback) {
        calback(null, chain.sign(digest));
    }

    this.verify = function (digest, signature, callback) {
        callback(null, chain.verify(digest, signature));
    }
}


exports.getAgentSafeBox = function (agent, blockSize) {
    let sb = new AgentSafeBox(agent, blockSize);

    return sb;

}
