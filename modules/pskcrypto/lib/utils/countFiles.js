const fs = require('fs');
const path = require('path');
const yauzl = require('yauzl');

function validatePath(user_input) {
    if (user_input.indexOf('\0') !== -1) {
        throw 'Access denied';
    }
    if (!/^[a-z0-9]+$/.test(user_input)) {
        throw 'Access denied';
    }
    let path = require('path');
    let safe_input = path.normalize(user_input).replace(/^(\.\.(\/|\\|$))+/, '');

    return safe_input;
}

function countFiles(inputPath, callback) {
    let total = 0;
    try{
        inputPath = validatePath(inputPath);
    }catch (e){
        return callback(e);
    }

    fs.stat(inputPath, (err, stats) => {
        if (err) {
            return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to get stats for file <${inputPath}>`, err));
        }

        if (stats.isFile()) {
            return callback(undefined, 1);
        }

        fs.readdir(inputPath, (err, files) => {
            if (err) {
                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to read dir <${inputPath}>`, err));
            }


            total = files.length;
            let count = files.length;

            if (total === 0) {
                return callback(undefined, 0);
            }

            files.forEach(file => {
                const filePath = path.join(inputPath, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) {
                        return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to get stats for file <${filePath}>`, err));
                    }

                    if (stats.isDirectory()) {
                        --total;
                        const folderPath = path.join(inputPath, file);
                        countFiles(folderPath, (err, filesNumber) => {
                            if (err) {
                                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to get count files in folder <${folderPath}>`, err));
                            }

                            total += filesNumber;


                            if (--count === 0) {
                                callback(undefined, total);
                            }
                        });
                    } else {
                        if (!stats.isFile()) {
                            --total;
                        }

                        if (--count === 0) {
                            callback(undefined, total);
                        }
                    }
                });
            })
        });
    });
}

function countZipEntries(inputPath, callback) {
    let processed = 0;

    yauzl.open(inputPath, {lazyEntries: true}, (err, zipFile) => {
        if (err) {
            return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to open zip file <${inputPath}>`, err));
        }

        zipFile.readEntry();
        zipFile.once("end", () => {
            callback(null, processed);
        });

        zipFile.on("entry", () => {
            ++processed;

            zipFile.readEntry();
        });
    });
}

function computeSize(inputPath, callback) {
    let totalSize = 0;
    try{
        inputPath = validatePath(inputPath);
    }catch (e){
        return callback(e);
    }
    fs.stat(inputPath, (err, stats) => {
        if (err) {
            return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to get stats for file <${inputPath}>`, err));
        }

        if (stats.isFile()) {
            return callback(undefined, stats.size);
        }

        fs.readdir(inputPath, (err, files) => {
            if (err) {
                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to read dir <${inputPath}>`, err));
            }


            let count = files.length;

            if (count === 0) {
                return callback(undefined, 0);
            }

            files.forEach(file => {
                const filePath = path.join(inputPath, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) {
                        return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to get stats for file <${filePath}>`, err));
                    }

                    if (stats.isDirectory()) {
                        const folderPath = path.join(inputPath, file);
                        computeSize(folderPath, (err, filesSize) => {
                            if (err) {
                                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to get count files in folder <${folderPath}>`, err));
                            }

                            totalSize += filesSize;

                            if (--count === 0) {
                                callback(undefined, totalSize);
                            }
                        });
                    } else {

                        totalSize += stats.size;

                        if (--count === 0) {
                            callback(undefined, totalSize);
                        }
                    }
                });
            })
        });
    });
}

module.exports = {
    countFiles,
    countZipEntries,
    computeSize
};
