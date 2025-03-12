/**
 * Jenkins hash function - one at a time hash function
 * https://en.wikipedia.org/wiki/Jenkins_hash_function
 */

function jenkins(key) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash += key.charCodeAt(i);
        hash += hash << 10;
        hash ^= hash >>> 6;
    }

    hash += hash << 3;
    hash ^= hash >>> 11;
    hash += hash << 15;
    return hash >>> 0;
}

module.exports = jenkins;
