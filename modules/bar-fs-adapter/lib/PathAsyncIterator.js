function PathAsyncIterator(inputPath) {
    const fsModule = "fs";
    const fs = require(fsModule);
    const pathModule = "path";
    const path = require(pathModule);
    const TaskCounter = require("swarmutils").TaskCounter;

    inputPath = path.normalize(inputPath);
    let removablePathLen;
    const fileList = [];
    const folderList = [];
    let isFirstCall = true;
    let pathIsFolder;

    this.next = function (callback) {
        if (isFirstCall === true) {
            isDir(inputPath, (err, status) => {
                if (err) {
                    return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to check if <${inputPath}> is directory`, err));
                }

                isFirstCall = false;
                pathIsFolder = status;
                if (status === true) {
                    if (!inputPath.endsWith(path.sep)) {
                        inputPath += path.sep;
                    }

                    removablePathLen = inputPath.length;
                    folderList.push(inputPath);
                    getNextFileFromFolder(callback);
                } else {
                    const fileName = path.basename(inputPath);
                    const fileParentFolder = path.dirname(inputPath);
                    callback(undefined, fileName, fileParentFolder);
                }
            });
        } else if (pathIsFolder) {
            getNextFileFromFolder(callback);
        } else {
            callback();
        }
    };

    function walkFolder(folderPath, callback) {
        const taskCounter = new TaskCounter(() => {
            if (fileList.length > 0) {
                const fileName = fileList.shift();
                return callback(undefined, fileName, inputPath);
            }

            if (folderList.length > 0) {
                const folderName = folderList.shift();
                return walkFolder(folderName, callback);
            }

            return callback();
        });

        fs.readdir(folderPath, (err, files) => {
            if (err) {
                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to read dir  <${folderPath}>`, err));
            }

            if (files.length === 0 && folderList.length === 0) {
                return callback();
            }

            if (files.length === 0) {
                walkFolder(folderList.shift(), callback);
            }
            taskCounter.increment(files.length);

            files.forEach(file => {
                let filePath = path.join(folderPath, file);
                isDir(filePath, (err, status) => {
                    if (err) {
                        return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to check if <${filePath}> is directory`, err));
                    }

                    if (status) {
                        folderList.push(filePath);
                    } else {
                        fileList.push(filePath.substring(removablePathLen));
                    }

                    taskCounter.decrement();
                });
            });
        });
    }

    function isDir(filePath, callback) {
        fs.stat(filePath, (err, stats) => {
            if (err) {
                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to get stats for file <${filePath}>`, err));
            }

            return callback(undefined, stats.isDirectory());
        });
    }

    function getNextFileFromFolder(callback) {
        if (fileList.length === 0 && folderList.length === 0) {
            return callback();
        }

        if (fileList.length > 0) {
            const fileName = fileList.shift();
            return callback(undefined, fileName, inputPath);
        }

        const folder = folderList.shift();
        walkFolder(folder, (err, file) => {
            if (err) {
                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to walk folder  <${folder}>`, err));
            }

            callback(undefined, file, inputPath);
        });
    }
}

module.exports = PathAsyncIterator;