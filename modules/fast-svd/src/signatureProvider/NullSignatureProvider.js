function NullSignatureProvider() {
    this.sign = function (blockNo, change) {
        if (change == undefined) {
            throw new Error("Invalid attempt to sign an undefined change");
        }
        return "<<NULLSIGNATURE>>";
    }
}

module.exports.create = function () {
    return new NullSignatureProvider();
}