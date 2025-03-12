function FsAdapter() {
    const fsModule = "fs";
    const fs = require(fsModule);
    const pathModule = "path";
    const path = require(pathModule);
    const PathAsyncIterator = require('./PathAsyncIterator');

    this.getFileSize = function (filePath, callback) {
        fs.stat(filePath, (err, stats) => {
            if (err) {
                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper("Failed to get file size", err));
            }

            callback(undefined, stats.size);
        });
    };

    this.readBlockFromFile = function (filePath, blockStart, blockEnd, callback) {
        const readStream = fs.createReadStream(filePath, {
            start: blockStart,
            end: blockEnd
        });

        let data = $$.Buffer.alloc(0);

        readStream.on("data", (chunk) => {
            data = $$.Buffer.concat([data, chunk]);
        });

        readStream.on("error", (err) => {
            return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper("Failed to read data from file " + filePath, err));
        });

        readStream.on("end", () => {
            callback(undefined, data);
        });
    };

    this.getFilesIterator = function (inputPath) {
        return new PathAsyncIterator(inputPath);
    };

    this.appendBlockToFile = function (filePath, data, callback) {
        fs.access(filePath, (err) => {
            if (err) {
                fs.mkdir(path.dirname(filePath), {recursive: true}, (err) => {
                    if (err && err.code !== "EEXIST") {
                        return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper("Failed to append block to file " + filePath, err));
                    }

                    fs.appendFile(filePath, data, callback);
                });
            } else {
                fs.appendFile(filePath, data, callback);
            }
        });
    };
}

module.exports = FsAdapter;