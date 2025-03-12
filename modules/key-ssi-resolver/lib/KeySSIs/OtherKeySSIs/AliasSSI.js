const SSITypes = require("../SSITypes");
const SSIFamilies = require("../SSIFamilies");

function AliasSSI(enclave, identifier) {
    if (typeof enclave === "string") {
        identifier = enclave;
        enclave = undefined;
    }
    const KeySSIMixin = require("../KeySSIMixin");
    KeySSIMixin(this, enclave);

    if (typeof identifier !== "undefined") {
        this.autoLoad(identifier);
    }

    this.initialize = (domain, alias, vn, hint, callback) => {
        if (typeof alias === "function") {
            callback = alias;
            alias = domain;
            domain = undefined;
        }

        if (typeof vn === "function") {
            callback = vn;
            vn = 'v0';
        }
        if (typeof hint === "function") {
            callback = hint;
            hint = undefined;
        }
        if (typeof domain === "undefined") {
            if (process.env.VAULT_DOMAIN) {
                this.load(SSITypes.ALIAS_SSI, process.env.VAULT_DOMAIN, alias, '', vn, hint);
                return callback(undefined, this);
            }

            const scAPI = require("opendsu").loadAPI("sc");
            return scAPI.getVaultDomain((err, vaultDomain) => {
                if (err) {
                    return callback(err);
                }

                this.load(SSITypes.ALIAS_SSI, vaultDomain, alias, '', vn, hint);
                return callback(undefined, this);
            });
        }

        this.load(SSITypes.ALIAS_SSI, domain, alias, '', vn, hint);
        callback(undefined, this);
    };

    this.isAlias = () => {
        return true;

    }
    this.deriveSync = () => {
        throw Error("Alias SSI cannot be derived");
    }

    this.derive = (callback) => {
        callback(Error("Alias SSI cannot be derived"));
    }

    this.getSSIFamilyName = () => {
        return SSIFamilies.SEED_SSI_FAMILY;
    }
}

const createAliasSSI = (enclave, identifier) => {
    return new AliasSSI(enclave, identifier);
}

module.exports = {
    createAliasSSI
};