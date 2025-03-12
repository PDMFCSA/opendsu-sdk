function InMemoryBitCollectionStrategy(options) {
    let {byteCount, data} = options;

    this.buffer = new ArrayBuffer(byteCount);
    this.unit8 = new Uint8Array(this.buffer);

    if (data) {
        data.split(",").forEach((byteValue, idx) => {
            this.unit8[idx] = parseInt(byteValue, 10);
        });
    }
}

/**
 * Returns the serialised bytes
 */
InMemoryBitCollectionStrategy.prototype.serialise = function () {
    return this.unit8.toString();
};

/**
 * Returns the bit value at position 'index'.
 */
InMemoryBitCollectionStrategy.prototype.getIndex = function (index) {
    const value = this.unit8[index >> 3];
    const offset = index & 0x7;
    return (value >> (7 - offset)) & 1;
};

/**
 * Sets the bit value at specified position 'index'.
 */
InMemoryBitCollectionStrategy.prototype.setIndex = function (index) {
    const offset = index & 0x7;
    this.unit8[index >> 3] |= 0x80 >> offset;
};

/**
 * Clears the bit at position 'index'.
 */
InMemoryBitCollectionStrategy.prototype.clearIndex = function (index) {
    const offset = index & 0x7;
    this.unit8[index >> 3] &= ~(0x80 >> offset);
};

/**
 * Returns the byte length of this array buffer.
 */
InMemoryBitCollectionStrategy.prototype.length = function () {
    return this.unit8.byteLength;
};

module.exports = InMemoryBitCollectionStrategy;
