let meta = "meta";

function OwM(serialized) {

    if (serialized) {
        return OwM.prototype.convert(serialized);
    }

    Object.defineProperty(this, meta, {
        writable: false,
        enumerable: true,
        value: {}
    });

    Object.defineProperty(this, "setMeta", {
        writable: false,
        enumerable: false,
        configurable: false,
        value: function (prop, value) {
            if (typeof prop == "object" && typeof value == "undefined") {
                for (let p in prop) {
                    this[meta][p] = prop[p];
                }
                return prop;
            }
            this[meta][prop] = value;
            return value;
        }
    });

    Object.defineProperty(this, "getMeta", {
        writable: false,
        value: function (prop) {
            return this[meta][prop];
        }
    });
}

function testOwMSerialization(obj) {
    let res = false;

    if (obj) {
        res = typeof obj[meta] != "undefined" && !(obj instanceof OwM);
    }

    return res;
}

OwM.prototype.convert = function (serialized) {
    const owm = new OwM();

    for (let metaProp in serialized.meta) {
        if (!testOwMSerialization(serialized[metaProp])) {
            owm.setMeta(metaProp, serialized.meta[metaProp]);
        } else {
            owm.setMeta(metaProp, OwM.prototype.convert(serialized.meta[metaProp]));
        }
    }

    for (let simpleProp in serialized) {
        if (simpleProp === meta) {
            continue;
        }

        if (!testOwMSerialization(serialized[simpleProp])) {
            owm[simpleProp] = serialized[simpleProp];
        } else {
            owm[simpleProp] = OwM.prototype.convert(serialized[simpleProp]);
        }
    }

    return owm;
};

OwM.prototype.getMetaFrom = function (obj, name) {
    let res;
    if (!name) {
        res = obj[meta];
    } else {
        res = obj[meta][name];
    }
    return res;
};

OwM.prototype.setMetaFor = function (obj, name, value) {
    obj[meta][name] = value;
    return obj[meta][name];
};

module.exports = OwM;