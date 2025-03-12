const removeDir = (...args) => {
    const fs = require("fs");
    if (typeof fs.rm !== "function") {
        return fs.rmdir(...args);
    }
    return fs.rm(...args);
}

const removeDirSync = (...args) => {
    const fs = require("fs");
    if (typeof fs.rmSync !== "function") {
        return fs.rmdirSync(...args);
    }
    return fs.rmSync(...args);
}

module.exports = {
    removeDirSync,
    removeDir
}