"use strict";
Object.defineProperty(exports, "__esModule", {value: true});
exports.default = void 0;
const crypto_1 = require("crypto");
Object.defineProperty(exports, "default", {
    enumerable: true, get: function () {
        return crypto_1.randomFillSync;
    }
});
