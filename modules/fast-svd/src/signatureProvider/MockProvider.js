function MockSignatureProvider() {
    this.sign = function (blockNo, change) {
        if (change == undefined) {
            throw new Error("Invalid attempt to sign an undefined change");
        }
        return "<<Mock Signature for  block " + blockNo + " and change " + JSON.stringify(change) + ">>";
    }
}

module.exports.create = function () {
    return new MockSignatureProvider();
}