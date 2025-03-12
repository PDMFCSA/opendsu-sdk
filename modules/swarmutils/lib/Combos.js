function product(args) {
    if (!args.length) {
        return [[]];
    }
    let prod = product(args.slice(1)), r = [];
    args[0].forEach(function (x) {
        prod.forEach(function (p) {
            r.push([x].concat(p));
        });
    });
    return r;
}

function objectProduct(obj) {
    let keys = Object.keys(obj),
        values = keys.map(function (x) {
            return obj[x];
        });

    return product(values).map(function (p) {
        let e = {};
        keys.forEach(function (k, n) {
            e[k] = p[n];
        });
        return e;
    });
}

module.exports = objectProduct;