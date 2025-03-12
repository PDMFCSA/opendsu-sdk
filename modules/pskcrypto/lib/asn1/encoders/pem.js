let inherits = require('util').inherits;

let DEREncoder = require('./der');

function PEMEncoder(entity) {
    DEREncoder.call(this, entity);
    this.enc = 'pem';
}

inherits(PEMEncoder, DEREncoder);
module.exports = PEMEncoder;

PEMEncoder.prototype.encode = function encode(data, options) {
    let buf = DEREncoder.prototype.encode.call(this, data);

    let p = buf.toString('base64');
    let out = ['-----BEGIN ' + options.label + '-----'];
    for (let i = 0; i < p.length; i += 64)
        out.push(p.slice(i, i + 64));
    out.push('-----END ' + options.label + '-----');
    return out.join('\n');
};
