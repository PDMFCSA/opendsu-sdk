const KeySSIMixin = require("../KeySSIMixin");
const SSITypes = require("../SSITypes");

function ConsensusSSI(identifier) {
    KeySSIMixin(this);
    const self = this;

    if (typeof identifier !== "undefined") {
        self.autoLoad(identifier);
    }

    self.initialize = (dlDomain, contractName, vn, hint) => {
        self.load(SSITypes.CONSENSUS_SSI, dlDomain, contractName, undefined, vn, hint);
    };
}

function createConsensusSSI(identifier) {
    return new ConsensusSSI(identifier);
}

module.exports = {
    createConsensusSSI,
};
