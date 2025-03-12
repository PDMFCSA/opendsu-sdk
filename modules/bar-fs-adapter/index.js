module.exports.createFsAdapter = () => {
    const FsAdapter = require("./lib/FsAdapter");
    return new FsAdapter();
};