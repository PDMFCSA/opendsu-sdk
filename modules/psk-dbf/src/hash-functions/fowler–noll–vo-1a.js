/**
 * Fowler–Noll–Vo hash function - FNV-1a hash variant
 * https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function#FNV-1a_hash
 */

//FNV constants.
const FNV_OFFSET_BASIS = 2166136261;

/**
 FNV hash function. (32-bit version)
 FNV step 1: hash = hash XOR byte.
 FNV step 2: hash = hash * FNV_Prime.
 */
function fowlerNollVo1a(value) {
    let hash = FNV_OFFSET_BASIS;
    for (let i = 0; i < value.length; ++i) {
        //Extract the 2 octets of value i.e. 16 bits (2 bytes).
        const c = value.charCodeAt(i);
        hash = xor(hash, c);
        hash = fnv_multiply(hash);
    }

    return hash >>> 0;
}

//FNV step 1:hash = hash XOR byte.
function xor(hash, byte) {
    return hash ^ byte;
}

//FNV step 2: hash = hash * FNV_Prime.
function fnv_multiply(hash) {
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    return hash;
}

module.exports = fowlerNollVo1a;
