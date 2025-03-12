const KeySSIMixin = require("../KeySSIMixin");

function TemplateSSI(enclave, identifier) {
    if (typeof enclave === "string") {
        identifier = enclave;
        enclave = undefined;
    }
    const self = this;
    KeySSIMixin(self, enclave);
    self.autoLoad(identifier);
}

function createTemplateSSI(enclave, identifier) {
    return new TemplateSSI(enclave, identifier);
}

module.exports = {
    createTemplateSSI
}