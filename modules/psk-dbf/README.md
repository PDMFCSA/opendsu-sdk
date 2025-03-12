# Dynamic Bloom Filter

This package implements a bloom filter for a general type of usage, with some usefull defaults in place.
The implementation follows the official algorithm, which can be seen [here](https://en.wikipedia.org/wiki/Bloom_filter).

# Usage

## Creating a Bloom Filter

```js
const BloomFilter = require("DynamicBloomFilter");

const bloomFilter = new BloomFilter({ estimatedElementCount: 100 });

bloomFilter.insert("element 1");
bloomFilter.insert("element 2");

bloomFilter.test("element 1"); // returns true
bloomFilter.test("element 3"); // returns false
```

## Configuring the Bloom Filter

`BloomFilter` accepts an option parameter that configures various aspects of the Bloom Filter.

The following options are available:

| Option                  | Default value                                                                                                                                                                                                                                                                                                                                                                                         | Description                                                                                                                           |
|-------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| bitCount                | null                                                                                                                                                                                                                                                                                                                                                                                                  | bit count (represents the m variable from the algorithm) - if missing it will be computed based on estimatedElementCount              |
| hashFunctionCount       | null                                                                                                                                                                                                                                                                                                                                                                                                  | k hash functions count (represents the k variable from the algorithm) - if missing it will be computed based on estimatedElementCount |
| estimatedElementCount   | 0                                                                                                                                                                                                                                                                                                                                                                                                     | estimated number of elements from the collection                                                                                      |
| falsePositiveTolerance  | 0.000001                                                                                                                                                                                                                                                                                                                                                                                              | allowed probability of false positives                                                                                                |
| hashFunction            | linearFowlerNollVoJenkinsHashFunction (defined inside src/hash-functions/linear-fowler–noll–vo-jenkins-hash-function.js) - linear hash function based on combination of [Fowler–Noll–Vo hash function - FNV-1a hash variant](https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function#FNV-1a_hash) and [Jenkins hash function](https://en.wikipedia.org/wiki/Jenkins_hash_function) | default function that returns the element's hash                                                                                      |
| cryptoHashFunction      | sha2                                                                                                                                                                                                                                                                                                                                                                                                  | crypto hash function that returns the element's hash                                                                                  |
| cryptoHashFunctionCount | 0                                                                                                                                                                                                                                                                                                                                                                                                     | number of crypto hash functions to be used (will be used at first before the default hashFunction)                                    |
| cryptoSecret            | "secret"                                                                                                                                                                                                                                                                                                                                                                                              | crypto hash function secret                                                                                                           |
| BitCollectionStrategy   | InMemoryBitCollectionStrategy (defined in src/in-memory-bit-collection-strategy.js) - keeps the bit collection in memory and applies bit operations                                                                                                                                                                                                                                                   | strategy which interacts with the bit collection                                                                                      |

### hashFunction

Needs to be a function that returns a positive number representing the bit position that will be set to 1. It accepts 3
arguments: (data, index, options):

- data: the value that needs to be hashed
- index: the index of the current k hash function, ranges [0, k)
- options: the options object that is used by the BloomFilter

### BitCollectionStrategy

Needs to be a function constructor that accepts an single parameters representing the option object that is used by the
BloomFilter.
The function must have 2 methods defined:

- getIndex - function that receives an index: number and returns the value of the index's bit of the collection
- setIndex - function that receives an index: number and sets the value of the index's bit of the collection to 1
