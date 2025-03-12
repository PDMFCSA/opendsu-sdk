const sha2 = require("./crypto-hash-functions/sha2");
const linearFowlerNollVoJenkinsHashFunction = require("./hash-functions/linear-fowler–noll–vo-jenkins-hash-function");
const InMemoryBitCollectionStrategy = require("./in-memory-bit-collection-strategy");

const BITS_IN_BYTE = 8;

const DEFAULT_OPTIONS = {
    // bit count
    bitCount: null,
    // k hash functions count
    hashFunctionCount: null,
    // estimated number of elements from the collection
    estimatedElementCount: 0,
    // allowed probability of false positives
    falsePositiveTolerance: 0.000001,

    // default function that returns the element's hash
    hashFunction: linearFowlerNollVoJenkinsHashFunction,

    // crypto hash function that returns the element's hash
    cryptoHashFunction: sha2,
    // number of crypto hash functions to be used (will be used at first before the default hashFunction)
    cryptoHashFunctionCount: 0,
    // crypto hash function secret
    cryptoSecret: "secret",

    // strategy which interacts with the bit collection
    BitCollectionStrategy: InMemoryBitCollectionStrategy,
};

/**
 * Bloom filter implementation
 * https://en.wikipedia.org/wiki/Bloom_filter
 */

function BloomFilter(serialisation, options) {
    if (typeof serialisation !== "string") {
        options = serialisation;
        serialisation = null;
    }

    let serialisationData;

    this.options = {...DEFAULT_OPTIONS, ...(options || {estimatedElementCount: 1})};

    if (serialisation) {
        let serialisationOptions = JSON.parse(serialisation);
        const {data, ...filterOptions} = serialisationOptions;
        this.options = {...this.options, ...filterOptions, ...(options || {})};
        serialisationData = data;
        console.log({filterOptions, options});
    }

    const {estimatedElementCount, falsePositiveTolerance, BitCollectionStrategy} = this.options;
    let {bitCount, hashFunctionCount} = this.options;

    if (estimatedElementCount) {
        if (!bitCount) {
            bitCount = Math.ceil(
                (-1 * estimatedElementCount * Math.log(falsePositiveTolerance)) / Math.pow(Math.log(2), 2)
            );
        }
        if (!hashFunctionCount) {
            hashFunctionCount = Math.ceil(Math.log(2) * (bitCount / estimatedElementCount));
        }
    }

    const byteCount = bitCount > BITS_IN_BYTE ? Math.ceil(bitCount / BITS_IN_BYTE) : 1;

    this.options = {
        ...this.options,
        bitCount,
        hashFunctionCount,
        byteCount,
    };

    this.bitCollectionStrategy = new BitCollectionStrategy({...this.options, data: serialisationData});
    console.log("Configuring Bloom filter ", this.options);
}

BloomFilter.prototype.bloomFilterSerialisation = function () {
    const {
        options: {estimatedElementCount, falsePositiveTolerance},
        bitCollectionStrategy,
    } = this;
    const serialisation = {
        estimatedElementCount,
        falsePositiveTolerance,
        data: bitCollectionStrategy.serialise(),
    };
    return JSON.stringify(serialisation);
};

BloomFilter.prototype.calculateHash = function (data, index) {
    const {options} = this;
    const {hashFunction, cryptoHashFunction, cryptoHashFunctionCount} = options;

    const mustUseCryptoHash = 0 < cryptoHashFunctionCount && index < cryptoHashFunctionCount;
    const currentIndexHashFunction = mustUseCryptoHash ? cryptoHashFunction : hashFunction;

    const hash = currentIndexHashFunction(data, index, options);
    return hash;
};

BloomFilter.prototype.insert = function (data) {
    const {bitCollectionStrategy, options} = this;
    const {hashFunctionCount} = options;

    for (let index = 0; index < hashFunctionCount; index++) {
        const hash = this.calculateHash(data, index);
        bitCollectionStrategy.setIndex(hash);
    }
};

BloomFilter.prototype.test = function (data) {
    const {bitCollectionStrategy, options} = this;
    const {hashFunctionCount} = options;

    for (let index = 0; index < hashFunctionCount; index++) {
        const hash = this.calculateHash(data, index);
        if (!bitCollectionStrategy.getIndex(hash)) {
            return false;
        }
    }

    return true;
};

module.exports = BloomFilter;
