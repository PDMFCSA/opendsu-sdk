function VersionlessDSUContentHandler(versionlessDSU, content) {
    const crypto = require("opendsu").loadAPI("crypto");
    const pskPath = require("swarmutils").path;
    const MANIFEST_PATH = "manifest";
    const getCurrentTime = () => {
        return new Date().getTime();
    };

    const readManifestFileContent = () => {
        let manifestContent;
        try {
            manifestContent = this.readFile(MANIFEST_PATH);
            manifestContent = JSON.parse(manifestContent);
        } catch (e) {
            manifestContent = {mounts: {}};
        }
        return manifestContent;
    }

    /**
     * @param {string} nodePath
     * @return {string} Returns trailing name component of a path
     */
    const basename = (path) => {
        const segments = path.split("/");
        return segments.pop();
    };

    const processPath = (path) => {
        path = pskPath.normalize(path);
        if (path.startsWith("/")) {
            path = path.substring(1);
        }
        return path;
    };

    const joinPath = (...paths) => {
        return pskPath.join(...paths);
    };

    const processPathForSearching = (path) => {
        path = processPath(path);
        if (path && !path.endsWith("/")) {
            // ensure we are excluding the desired folder (if provided)
            path = `${path}/`;
        }
        return path;
    };

    const isSubPath = (path, subPath) => {
        if (!path.startsWith("/")) {
            path = `/${path}`;
        }
        if (!subPath.startsWith("/")) {
            subPath = `/${subPath}`;
        }
        // the method doesn't handle that case of relative path very well,
        // so we force absolute paths
        return pskPath.isSubpath(path, subPath);
    };

    const isFilePresent = (path) => {
        return !!content.files[path];
    };

    const isFolderPresent = (path) => {
        return !!content.folders[path];
    };

    const isEntryPresentForSearching = (entry, path, recursive) => {
        if (!entry.startsWith(path)) {
            return false;
        }

        if (recursive) {
            return true;
        }

        // for non recursive, we need to ignore inner files/folders
        const relativePathFromSearch = entry.substring(path.length);
        return !relativePathFromSearch || relativePathFromSearch.indexOf("/") === -1;
    };

    const getParentFolderForFile = (filePath) => {
        filePath = processPath(filePath);
        const lastSlashIndex = filePath.lastIndexOf("/");
        if (lastSlashIndex === -1) {
            // parent folder is root
            return "/";
        }
        const parentFolder = filePath.substring(0, lastSlashIndex);
        return parentFolder;
    };

    const ensureFolderStructureForFilePath = (path) => {
        path = processPath(path);
        const segments = path.split("/");
        segments.pop(); // remove file name

        // ensure root folder exists
        if (!isFolderPresent("/")) {
            updateFolderWriteTime("/");
        }

        let currentPath = "";
        segments.forEach((segment) => {
            currentPath = joinPath(currentPath, segment);
            if (!isFolderPresent(currentPath)) {
                updateFolderWriteTime(currentPath);
            }
        });
    };

    const updateRecordWriteTime = (record) => {
        const currentTime = getCurrentTime();
        record.ctime = currentTime;
        record.mtime = currentTime;
        record.atime = currentTime;
    };

    const ensureFileEntry = (path) => {
        if (!content.files[path]) {
            content.files[path] = {
                content: null,
            };
            updateRecordWriteTime(content.files[path]);
        }
        return content.files[path];
    };

    const updateFileWriteTime = (path) => {
        const fileEntry = ensureFileEntry(path);
        updateRecordWriteTime(fileEntry);
    };

    const updateFileAccessTime = (path) => {
        const fileEntry = ensureFileEntry(path);
        fileEntry.atime = getCurrentTime();
    };

    const ensureFolderEntry = (path) => {
        if (!content.folders[path]) {
            content.folders[path] = {};
            updateRecordWriteTime(content.folders[path]);
        }
        return content.folders[path];
    };

    const updateFolderWriteTime = (path) => {
        const folderEntry = ensureFolderEntry(path);
        updateRecordWriteTime(folderEntry);
    };

    const updateFolderAccessTime = (path) => {
        const folderEntry = ensureFolderEntry(path);
        folderEntry.atime = getCurrentTime();
    };

    const addFileFromFsAsync = async (filePath, destinationFilePath) => {
        const fsModule = "fs";
        const fs = require(fsModule);

        const content = await $$.promisify(fs.readFile.bind(fs))(filePath);
        this.writeFile(destinationFilePath, content);
    };

    const getFilesFromFsAsync = async (folder) => {
        const fsModule = "fs";
        const pathModule = "path";
        const fs = require(fsModule).promises;
        const path = require(pathModule);

        const dirents = await fs.readdir(folder, {withFileTypes: true});

        const files = await Promise.all(
            dirents.map((dirent) => {
                const res = path.resolve(folder, dirent.name);
                return dirent.isDirectory() ? getFilesFromFsAsync(res) : res;
            })
        );
        return Array.prototype.concat(...files);
    };

    const getRelativeFilesFromFsAsync = async (folder) => {
        const pathModule = "path";
        const path = require(pathModule);
        const fullPathFiles = await getFilesFromFsAsync(folder);
        const relativePathFiles = fullPathFiles.map((file) => path.relative(folder, file));
        return relativePathFiles;
    };

    const ensureFSDirectoryExistence = async (filePath) => {
        const fsModule = "fs";
        const pathModule = "path";
        const fs = require(fsModule).promises;
        const path = require(pathModule);
        let dirname = path.dirname(filePath);
        try {
            await fs.stat(dirname);
        } catch (error) {
            await ensureFSDirectoryExistence(dirname);
            await fs.mkdir(dirname);
        }
    };

    const getArchive = (seed, mountOptions, callback) => {
        if (typeof mountOptions === "function") {
            callback = mountOptions;
            mountOptions = {};
        }

        const resolver = require("opendsu").loadApi("resolver");
        resolver.loadDSU(seed, (err, dsu) => {
            if (err) {
                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to load DSU from keySSI ${seed}`, err));
            }

            if (typeof dsu.getBarInstance === "function") {
                return callback(undefined, dsu.getBarInstance());
            }

            callback(undefined, dsu);
        });
    };

    this.createFolder = (path) => {
        path = processPath(path);
        ensureFolderStructureForFilePath(path);
        updateFolderWriteTime(path);
    };

    this.delete = (path) => {
        path = processPath(path);

        if (isFilePresent(path)) {
            delete content.files[path];
            return;
        }

        if (isFolderPresent(path)) {
            // remove file/folders under path
            const files = this.getFiles(path, true);
            files.forEach((file) => {
                const fullFilePath = processPath(joinPath(path, file));
                delete content.files[fullFilePath];
            });

            const folders = this.getFolders(path, true);
            folders.forEach((folder) => {
                const fullFolderPath = processPath(joinPath(path, folder));
                delete content.folders[fullFolderPath];
            });

            delete content.folders[path];

        }

        // comment out error in order to be compliant with standard DSU interface
        // throw new Error(`No file/folder present at ${path}!`);
    };

    this.rename = (sourcePath, destinationPath) => {
        sourcePath = processPath(sourcePath);
        destinationPath = processPath(destinationPath);

        if (isFilePresent(sourcePath)) {
            if (isFilePresent(destinationPath)) {
                throw new Error(`Cannot rename file ${sourcePath} to ${destinationPath} since destination already exists!`);
            }

            ensureFileEntry(destinationPath);
            updateFileWriteTime(destinationPath);
            content.files[destinationPath].content = content.files[sourcePath].content;
            delete content.files[sourcePath];
            return;
        }

        if (isFolderPresent(sourcePath)) {
            if (isFolderPresent(destinationPath)) {
                throw new Error(`Cannot rename folder ${sourcePath} to ${destinationPath} since destination already exists!`);
            }

            // rename file/folders under path
            const files = this.getFiles(sourcePath, true);
            files.forEach((file) => {
                const initialFullFilePath = processPath(joinPath(sourcePath, file));
                const destinationFullFilePath = processPath(joinPath(destinationPath, file));
                updateFileWriteTime(destinationFullFilePath);
                content.files[destinationFullFilePath].content = content.files[initialFullFilePath].content;
                delete content.files[initialFullFilePath];
            });

            const folders = this.getFolders(sourcePath, true);
            folders.forEach((folder) => {
                const initialFullFolderPath = processPath(joinPath(sourcePath, folder));
                const destinationFullFolderPath = processPath(joinPath(destinationPath, folder));
                content.folders[destinationFullFolderPath] = content.folders[initialFullFolderPath];
                updateFolderWriteTime(destinationFullFolderPath);
                delete content.folders[initialFullFolderPath];
            });

            updateFolderWriteTime(destinationPath);
            content.folders[destinationPath] = content.folders[sourcePath];
            delete content.folders[sourcePath];
            return;
        }

        throw new Error(`No file/folder present at ${sourcePath}!`);
    };

    this.getFolders = (path, recursive) => {
        const currentPath = processPath(path);
        if (isFolderPresent(currentPath)) {
            updateFolderAccessTime(currentPath);
        }

        path = processPathForSearching(path);
        const folders = Object.keys(content.folders)
            .filter((folder) => folder !== "/" && isEntryPresentForSearching(folder, path, recursive))
            .map((folder) => {
                return folder.substring(path.length);
            });
        return folders;
    };

    this.getFiles = (path, recursive) => {
        path = processPathForSearching(path);
        const files = Object.keys(content.files)
            .filter((file) => isEntryPresentForSearching(file, path, recursive))

            .map((file) => {
                return file.substring(path.length);
            });
        return files;
    };

    this.addFile = async (sourceFilePath, destinationFilePath, callback) => {
        try {
            await addFileFromFsAsync(sourceFilePath, destinationFilePath);
            callback();
        } catch (error) {
            callback(error);
        }
    };

    this.addFiles = async (filePaths, basePath, callback) => {
        try {
            for (const filePath of filePaths) {
                const fileName = basename(processPath(filePath));
                const destinationFilePath = joinPath(basePath, fileName);
                await addFileFromFsAsync(filePath, destinationFilePath);
            }
            callback();
        } catch (error) {
            callback(error);
        }
    };

    this.addFolder = async (folderPath, basePath, callback) => {
        try {
            const relativeFilePaths = await getRelativeFilesFromFsAsync(folderPath);
            for (const relativeFilePath of relativeFilePaths) {
                const fullFilePath = joinPath(folderPath, relativeFilePath);
                const destinationFilePath = joinPath(basePath, relativeFilePath);
                await addFileFromFsAsync(fullFilePath, destinationFilePath);
            }
            callback();
        } catch (error) {
            callback(error);
        }
    };

    this.extractFile = async (fsDestinationFilePath, sourceFilePath, callback) => {
        sourceFilePath = processPath(sourceFilePath);
        try {
            const sourceFileContent = this.readFile(sourceFilePath);

            await ensureFSDirectoryExistence(fsDestinationFilePath);
            const fs = require("fs");
            await $$.promisify(fs.writeFile.bind(fs))(fsDestinationFilePath, sourceFileContent);
            callback();
        } catch (error) {
            callback(error);
        }
    };

    this.extractFolder = async (fsDestinationFolderPath, sourceFolderPath, callback) => {
        try {
            sourceFolderPath = processPath(sourceFolderPath);
            if (!isFolderPresent(sourceFolderPath)) {
                return callback(new Error(`Source path <${sourceFolderPath}> not found.`));
            }

            const sourceFolders = this.getFolders(sourceFolderPath, true);
            if (sourceFolders.length) {
                for (const sourceFolder of sourceFolders) {
                    // const sourceFolderFullPath = joinPath(sourceFolderPath, sourceFolder);
                    const destinationFolderPath = joinPath(fsDestinationFolderPath, sourceFolder);
                    await ensureFSDirectoryExistence(destinationFolderPath);
                }
            }

            const sourceFiles = this.getFiles(sourceFolderPath, true);
            if (sourceFiles.length) {
                for (const sourceFile of sourceFiles) {
                    const sourceFilePath = joinPath(sourceFolderPath, sourceFile);
                    const destinationFilePath = joinPath(fsDestinationFolderPath, sourceFile);
                    await $$.promisify(this.extractFile.bind(this))(destinationFilePath, sourceFilePath);
                }
            }
            callback();
        } catch (error) {
            callback(error);
        }
    };

    this.writeFile = (path, data) => {
        path = processPath(path);

        ensureFolderStructureForFilePath(path);

        if (!isFilePresent(path)) {
            const parentFolderPath = getParentFolderForFile(path);
            updateFolderWriteTime(parentFolderPath);
        }

        const fileEntry = ensureFileEntry(path);
        updateFileWriteTime(path);
        fileEntry.content = crypto.base64URLEncode(data);
    };

    this.readFile = (path) => {
        path = processPath(path);
        if (!content.files[path]) {
            throw new Error(`No file present at ${path}!`);
        }

        updateFileAccessTime(path);
        let fileContent = crypto.base64URLDecode(content.files[path].content);
        if (!$$.Buffer.isBuffer(fileContent)) {
            fileContent = $$.Buffer.from(fileContent);
        }
        return fileContent;
    };

    this.appendToFile = (path, data) => {
        path = processPath(path);
        if (!$$.Buffer.isBuffer(data)) {
            data = $$.Buffer.from(data);
        }

        const fileEntry = ensureFileEntry(path);
        ensureFolderStructureForFilePath(path);

        let fileContent = fileEntry.content;
        if (fileContent != null) {
            fileContent = crypto.base64URLDecode(fileContent);
            if (!$$.Buffer.isBuffer(fileContent)) {
                fileContent = $$.Buffer.from(fileContent);
            }

            fileContent = $$.Buffer.concat([fileContent, data]);
        } else {
            fileContent = data;
        }

        updateFileWriteTime(path);
        fileEntry.content = crypto.base64URLEncode(fileContent);
    };

    this.validatePathToMount = (path) => {
        path = processPath(path);
        const manifestContent = readManifestFileContent();
        if (manifestContent.mounts[path]) {
            throw new Error(`Path ${path} is already mounted!`);
        }

        const filesAtPath = this.getFiles(path);
        if (filesAtPath.length > 0) {
            throw new Error(`Tried to mount in a non-empty folder at ${path}`);
        }
    };

    this.cloneFolder = (sourcePath, destinationPath) => {
        sourcePath = processPath(sourcePath);
        if (!isFolderPresent(sourcePath)) {
            throw new Error(`Source path <${sourcePath}> not found.`);
        }

        destinationPath = processPath(destinationPath);
        if (!isFolderPresent(destinationPath)) {
            this.createFolder(destinationPath);
        }

        const sourceFiles = this.getFiles(sourcePath, true);
        if (sourceFiles.length) {
            sourceFiles.forEach((sourceFile) => {
                const sourceFilePath = joinPath(sourcePath, sourceFile);
                const destinationFilePath = joinPath(destinationPath, sourceFile);
                updateFileWriteTime(destinationFilePath);
                content.files[destinationFilePath].content = content.files[sourceFilePath].content;
            });
        }

        const sourceFolders = this.getFolders(sourcePath, true);
        if (sourceFolders.length) {
            sourceFolders.forEach((sourceFolder) => {
                const sourceFolderPath = joinPath(sourcePath, sourceFolder);
                const destinationFilePath = joinPath(destinationPath, sourceFolder);
                content.folders[destinationFilePath] = content.folders[sourceFolderPath];
                updateFolderWriteTime(destinationFilePath);
            });
        }
    };

    this.stat = (path) => {
        path = processPath(path);
        if (!path || isFolderPresent(path)) {
            const folderInfo = content.folders[path] || {};
            return {type: "directory", ...folderInfo};
        }

        if (isFilePresent(path)) {
            const {ctime, mtime, atime} = content.folders[path] || {};
            return {type: "file", ctime, mtime, atime};
        }

        // default case in order to be compliant with standard DSU interface
        return {type: undefined};
    };

    this.getSSIForMount = (path) => {
        path = processPath(path);
        const manifestContent = readManifestFileContent();
        const mountPoint = manifestContent.mounts[path];
        return mountPoint ? mountPoint : null;
    };

    this.mount = (path, identifier) => {
        path = processPath(path);
        let manifestContent = readManifestFileContent();
        manifestContent.mounts[path] = identifier;
        // set manifest file in order to be compliant with standard DSU interface
        if (!content.files[MANIFEST_PATH]) {
            content.files[MANIFEST_PATH] = {};
        }
        this.writeFile(MANIFEST_PATH, JSON.stringify(manifestContent));
    };

    this.unmount = (path) => {
        path = processPath(path);
        const manifestContent = readManifestFileContent();
        if (!manifestContent.mounts[path]) {
            throw new Error(`No mount found at path ${path}`);
        }

        delete manifestContent.mounts[path]
        this.writeFile(MANIFEST_PATH, JSON.stringify(manifestContent));
    };

    this.getMountedDSUs = (path) => {
        path = processPath(path);
        const manifestContent = readManifestFileContent();
        const mountedDSUs = Object.keys(manifestContent.mounts)
            .filter((mountPointPath) => {
                return isSubPath(mountPointPath, path);
            })
            .map((mountPointPath) => {
                const identifier = manifestContent.mounts[mountPointPath];
                const result = {
                    path: mountPointPath,
                    identifier
                };
                return result;
            });

        return mountedDSUs;
    };

    this.getArchiveContextForPath = (path, callback) => {
        path = processPath(path);
        const manifestContent = readManifestFileContent();
        for (let mountPath in manifestContent.mounts) {
            const identifier = manifestContent.mounts[mountPath];
            if (mountPath === path) {
                return getArchive(identifier, (err, archive) => {
                    if (err) {
                        return OpenDSUSafeCallback(callback)(
                            createOpenDSUErrorWrapper(`Failed to load DSU mounted at mounting point ${mountPath}`, err)
                        );
                    }

                    return callback(undefined, {
                        prefixPath: path,
                        relativePath: "/",
                        archive: archive,
                        identifier,
                    });
                });
            }

            if (isSubPath(path, mountPath)) {
                return getArchive(identifier, (err, archive) => {
                    if (err) {
                        return OpenDSUSafeCallback(callback)(
                            createOpenDSUErrorWrapper(`Failed to load DSU mounted at mounting point ${mountPath}`, err)
                        );
                    }

                    let remainingPath = path.substring(mountPath.length);
                    remainingPath = processPath(remainingPath);
                    return archive.getArchiveForPath(remainingPath, function (err, result) {
                        if (err) {
                            return OpenDSUSafeCallback(callback)(
                                createOpenDSUErrorWrapper(`Failed to load DSU mounted at path ${remainingPath}`, err)
                            );
                        }
                        result.prefixPath = pskPath.join(mountPath, result.prefixPath);
                        callback(undefined, result);
                    });
                });
            }
        }

        callback(undefined, {prefixPath: "/", relativePath: path, archive: versionlessDSU});
    };
}

module.exports = VersionlessDSUContentHandler;
