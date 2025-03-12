const KeySSIMixin = require("../KeySSIMixin");

function ZaSSI(identifier) {
    KeySSIMixin(this);

    if (typeof identifier !== "undefined") {
        this.autoLoad(identifier);
    }

    this.derive = () => {
        throw Error("Not implemented");
    };
}

function createZaSSI(identifier) {
    return new ZaSSI(identifier);
}

module.exports = {
    createZaSSI
};