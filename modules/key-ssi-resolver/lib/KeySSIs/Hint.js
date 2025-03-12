const constants = require("./constants");

function Hint(hintSerialisation) {
    const {BRICKS_DOMAIN_KEY} = require('opendsu').constants;
    let _hintObject;

    const init = () => {
        if (hintSerialisation) {
            if (typeof hintSerialisation === "object") {
                _hintObject = hintSerialisation;
            } else {
                try {
                    _hintObject = JSON.parse(hintSerialisation);
                } catch (e) {
                    throw Error(`Hint should be a JSON. Received <${hintSerialisation}>`);
                }
            }
        }
    }

    this.set = (key, value) => {
        if (typeof _hintObject === "undefined") {
            _hintObject = {};
        }

        _hintObject[key] = value;
    }

    this.get = (key) => {
        return _hintObject[key];
    }

    this.setDSUVersion = (dsuVersion) => {
        this.set(constants.DSU_VERSION_KEY, dsuVersion);
    }

    this.getDSUVersion = () => {
        return this.get(constants.DSU_VERSION_KEY);
    }

    this.setBricksDomain = (bricksDomain) => {
        this.set(BRICKS_DOMAIN_KEY, bricksDomain);
    };

    this.getBricksDomain = () => {
        return this.get(BRICKS_DOMAIN_KEY);
    };

    this.setEmbeddedData = (embeddedData) => {
        this.set(constants.EMBEDDED_DATA_KEY, embeddedData);
    }

    this.getEmbeddedData = () => {
        return this.get(constants.EMBEDDED_DATA_KEY);
    }

    this.getSerialisation = () => {
        if (typeof _hintObject === "undefined") {
            return undefined;
        }

        let versionFreeHint = JSON.parse(JSON.stringify(_hintObject));
        if (typeof versionFreeHint[constants.DSU_VERSION_KEY] !== "undefined") {
            delete versionFreeHint[constants.DSU_VERSION_KEY];
        }

        return JSON.stringify(versionFreeHint);
    }

    init();
}

module.exports = Hint;
