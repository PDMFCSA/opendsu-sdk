const ArraySSI = require("./../ConstSSIs/ArraySSI");
const SSITypes = require("../SSITypes");

function WalletSSI(enclave, identifier) {
    const self = this;
    const arraySSI = ArraySSI.createArraySSI(enclave, identifier);

    arraySSI.getTypeName = () => {
        return SSITypes.WALLET_SSI;
    };

    Object.assign(self, arraySSI);
}

function createWalletSSI(enclave, identifier) {
    return new WalletSSI(enclave, identifier);
}

module.exports = {
    createWalletSSI
}
