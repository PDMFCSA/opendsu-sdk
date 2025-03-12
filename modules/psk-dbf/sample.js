const BloomFilter = require("./src/bloom-filter");

const bloomFilter = new BloomFilter({estimatedElementCount: 100});

Array.from(Array(10).keys()).forEach((i) => {
    const data = `element${i + 1}`;
    console.log(`Adding: ${data}...`);
    bloomFilter.insert(data);
});

const testElement = (element) => {
    const result = bloomFilter.test(element);
    console.log(`Element ${element}: ${result ? "possibly in set" : "definitely not in set"}`);
};

Array.from(Array(15).keys()).forEach((i) => {
    const data = `element${i + 1}`;
    testElement(data);
});

// Testing serialization
const serialisation = bloomFilter.bloomFilterSerialisation();
console.log({serialisation});

// Creating bloom filter clone via serialization
const bloomFilterClone = new BloomFilter(serialisation);

const cloneSerialisation = bloomFilterClone.bloomFilterSerialisation();
console.log({cloneSerialisation});

const testCloneElement = (element) => {
    const result = bloomFilterClone.test(element);
    console.log(`Element ${element}: ${result ? "possibly in set" : "definitely not in set"}`);
};

Array.from(Array(15).keys()).forEach((i) => {
    const data = `element${i + 1}`;
    testCloneElement(data);
});

console.log(bloomFilter.bitCollectionStrategy.buffer);
console.log(new TextEncoder().encode(bloomFilter.bitCollectionStrategy.buffer));
console.log(bloomFilter.bitCollectionStrategy.unit8);
console.log(new TextEncoder().encode(bloomFilterClone.bitCollectionStrategy.buffer));
console.log(bloomFilterClone.bitCollectionStrategy.unit8);
