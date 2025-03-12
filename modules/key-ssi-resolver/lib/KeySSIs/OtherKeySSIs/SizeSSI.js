const SSITypes = require("../SSITypes");
const KeySSIMixin = require("../KeySSIMixin");

function SizeSSI(enclave, identifier) {
    if (typeof enclave === "string") {
        identifier = enclave;
        enclave = undefined;
    }

    KeySSIMixin(this);
    const self = this;

    if (typeof identifier !== "undefined") {
        self.autoLoad(identifier);
    }

    self.initialize = (domain, totalSize, bufferSize, vn, hint) => {
        if (!domain) {
            throw new Error("domain is required");
        }
        if (totalSize == null) {
            throw new Error("totalSize is required");
        }
        if (bufferSize == null) {
            bufferSize = totalSize;
            vn = "v0";
        }
        if (vn == null) {
            vn = "v0";
        }

        self.load(SSITypes.SIZE_SSI, domain, totalSize, bufferSize, vn, hint);
    };

    self.isSizeSSI = () => {
        return true;
    };

    self.getTotalSize = () => {
        return parseInt(self.getSpecificString(), 10);
    };

    self.getBufferSize = () => {
        return parseInt(self.getControlString(), 10);
    };

    self.derive = () => {
        throw Error("Size SSI cannot be derived");
    };
}

const createSizeSSI = (enclave, identifier) => {
    return new SizeSSI(enclave, identifier);
};

module.exports = {
    createSizeSSI,
};
