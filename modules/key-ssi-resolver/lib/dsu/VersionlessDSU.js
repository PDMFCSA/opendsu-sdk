const VersionlessDSUController = require("./VersionlessDSUController");
const DSU_ENTRY_TYPES = {
    FILE: "FILE",
    FOLDER: "FOLDER",
};

let BatchInstacesNo = 0;

function VersionlessDSU(config) {
    const {keySSI} = config;
    const keySSISpace = require("opendsu").loadAPI("keyssi");
    let keySSIString;
    let keySSIObject;
    if (typeof keySSI === "string") {
        keySSIString = keySSI;
        keySSIObject = keySSISpace.parse(keySSI);
    } else {
        keySSIString = keySSI.getIdentifier();
        keySSIObject = keySSI;
    }

    let refreshInProgress = false;
    let refreshPromise = Promise.resolve();

    const controllerConfig = {
        keySSIString,
        keySSIObject,
    };
    const versionlessDSUController = new VersionlessDSUController(this, controllerConfig);

    const pskPath = require("swarmutils").path;

    const processPath = (path) => {
        path = pskPath.normalize(path);
        if (path.startsWith("/")) {
            path = path.substring(1);
        }
        return path;
    };

    function generateBatchId(isVirtual) {
        BatchInstacesNo++;
        if (isVirtual) {
            return `VB:${BatchInstacesNo}`
        } else {
            return `RB:${BatchInstacesNo}`
        }
    }

    /**
     * This function waits for an existing "refresh" operation to finish
     * before executing the `callback`.
     * If no refresh operation is in progress, the `callback` is executed
     * immediately.
     * This function is called by the public methods in order to prevent
     * calling methods on possible outdated content (content before reload)
     *
     * @param {function} callback
     */
    const waitIfDSUIsRefreshing = (callback) => {
        if (refreshInProgress === false) {
            return callback();
        }

        refreshPromise.then(() => {
            callback();
        });
    };

    const executeMountAwareOperation = ({path, options, onIgnoreMounts, checkReadonly, onMountCallback}) => {
        if (!options) {
            options = {ignoreMounts: false};
        }
        if (checkReadonly !== false) {
            checkReadonly = true;
        }

        waitIfDSUIsRefreshing(() => {
            if (options.ignoreMounts) {
                onIgnoreMounts();
            } else {
                this.getArchiveForPath(path, (err, archiveContext) => {
                    if (err) {
                        return OpenDSUSafeCallback(onMountCallback)(
                            createOpenDSUErrorWrapper(`Failed to load DSU instance mounted at path ${path}`, err)
                        );
                    }

                    if (checkReadonly && archiveContext.readonly === true) {
                        return onMountCallback(Error("Tried to write in a readonly mounted RawDossier"));
                    }

                    let onMountCallbackOptions = {
                        options: {...options, ignoreMounts: true},
                        archive: archiveContext.archive,
                        relativePath: archiveContext.relativePath,
                        prefixPath: archiveContext.prefixPath,
                    };
                    onMountCallback(undefined, onMountCallbackOptions);
                });
            }
        });
    };

    const getSaneCallbackFunction = (...args) => {
        for (let i = args.length - 1; i >= 0; i--) {
            if (typeof args[i] === "function") {
                return $$.makeSaneCallback(args[i]);
            }
        }
        throw new Error("No callback argument found!");
    };

    this.init = (callback) => {
        callback = $$.makeSaneCallback(callback);
        const controllerCallback = (error) => {
            if (error) {
                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to create versionless DSU`, error));
            }

            // return VersionlessDSU instance
            callback(null, this);
        };
        versionlessDSUController.createDSU(controllerCallback);
    };

    this.load = (callback) => {
        callback = $$.makeSaneCallback(callback);
        const controllerCallback = (error) => {
            if (error) {
                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to get versionless DSU`, error));
            }

            // return VersionlessDSU instance
            callback(null, this);
        };

        versionlessDSUController.loadDSU(controllerCallback);
    };

    this.loadVersion = (versionHash, callback) => {
        callback("NotApplicableForVersionlessDSU");
    };
    this.getBrickMapController = () => {
        throw new Error("NotApplicableForVersionlessDSU");
    };

    this.refresh = (callback) => {
        callback = $$.makeSaneCallback(callback);
        waitIfDSUIsRefreshing(() => {
            refreshInProgress = true;
            refreshPromise = refreshPromise.then(() => {
                return new Promise((resolve) => {
                    this.load((err) => {
                        if (err) {
                            refreshInProgress = false;
                            return resolve(OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper("Failed to load DSU", err)));
                        }

                        resolve(callback());
                    });
                }).catch(() => {
                    console.trace("This shouldn't happen. Refresh errors should have been already caught");
                });
            });
        });
    };

    this.getLastHashLinkSSI = (callback) => {
        console.log("This method is obsolete. Please use `dsu.getLatestAnchoredHashLink()` instead.");
        return this.getLatestAnchoredHashLink(callback);
    };

    this.getLatestAnchoredHashLink = (callback) => {
        // required for opendsu resolver loader
        return this.getKeySSIAsObject(callback);
    };

    this.getCurrentAnchoredHashLink = (callback) => {
        // required for opendsu resolver loader
        return this.getKeySSIAsObject(callback);
    };

    this.getKeySSI = (keySSIType, callback) => {
        console.trace("Obsolete function: use getKeySSIAsString or getKeySSIAsObject Instead");
        this.getKeySSIAsObject(keySSIType, callback);
    };

    this.getKeySSIAsObject = (keySSIType, callback) => {
        if (typeof keySSIType === "function") {
            callback = keySSIType;
        }
        callback = $$.makeSaneCallback(callback);
        callback(undefined, keySSIObject);
    };

    this.getKeySSIAsString = (keySSIType, callback) => {
        if (typeof keySSIType === "function") {
            callback = keySSIType;
        }
        callback = $$.makeSaneCallback(callback);
        callback(undefined, keySSIString);
    };

    this.getCreationSSI = (plain) => {
        return keySSIObject.getIdentifier(plain);
    };

    /**
     * @param {string} path
     * @param {string|$$.Buffer|stream.ReadableStream} data
     * @param {callback} callback
     */
    this.appendToFile = (path, data, options, callback) => {
        const defaultOpts = {encrypt: true, ignoreMounts: false};
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        callback = $$.makeSaneCallback(callback);
        options = Object.assign(defaultOpts, options);

        executeMountAwareOperation({
            path,
            options,
            onIgnoreMounts: () => {
                versionlessDSUController.appendToFile(path, data, options, callback);
            },
            onMountCallback: (error, {options, archive, relativePath}) => {
                if (error) {
                    return callback(error);
                }
                archive.appendToFile(relativePath, data, options, callback);
            },
        });
    };

    this.dsuLog = (message, callback) => {
        this.appendToFile("/dsu-metadata-log", message + "\n", {ignoreMissing: true}, callback);
    };

    /**
     * @param {object} rules
     * @param {object} rules.preWrite
     * @param {object} rules.afterLoad
     */
    this.setValidationRules = () => {
        throw Error("NotApplicableForVersionlessDSU");
    };

    this.setAnchoringEventListener = () => {
        throw new Error("NotApplicableForVersionlessDSU");
    };

    this.setDecisionCallback = (callback) => {
        callback("NotApplicableForVersionlessDSU");
    };

    this.getAnchoringStrategy = () => {
        throw new Error("NotApplicableForVersionlessDSU");
    };

    this.doAnchoring = (callback) => {
        callback("NotApplicableForVersionlessDSU");
    };

    this.getSSIForMount = (mountPoint, callback) => {
        callback = $$.makeSaneCallback(callback);
        waitIfDSUIsRefreshing(() => {
            versionlessDSUController.getSSIForMount(mountPoint, callback);
        });
    };

    this.addFolder = (folderPath, basePath, options, callback) => {
        const defaultOpts = {
            encrypt: true,
            ignoreMounts: false,
            embedded: false,
        };
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        callback = $$.makeSaneCallback(callback);
        options = Object.assign(defaultOpts, options);

        executeMountAwareOperation({
            path: basePath,
            options,
            onIgnoreMounts: () => {
                versionlessDSUController.addFolder(folderPath, basePath, options, callback);
            },
            onMountCallback: (error, {options, archive, relativePath}) => {
                if (error) {
                    return callback(error);
                }
                archive.addFolder(folderPath, relativePath, options, callback);
            },
        });
    };

    this.addFile = (filePath, destinationFilePath, options, callback) => {
        const defaultOpts = {
            encrypt: true,
            ignoreMounts: false,
            embedded: false,
        };
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        callback = $$.makeSaneCallback(callback);
        options = Object.assign(defaultOpts, options);

        executeMountAwareOperation({
            path: destinationFilePath,
            options,
            onIgnoreMounts: () => {
                versionlessDSUController.addFile(filePath, destinationFilePath, options, callback);
            },
            onMountCallback: (error, {options, archive, relativePath}) => {
                if (error) {
                    return callback(error);
                }
                archive.addFile(filePath, relativePath, options, callback);
            },
        });
    };

    this.addFiles = (filePaths, basePath, options, callback) => {
        const defaultOpts = {
            encrypt: true,
            ignoreMounts: false,
            embedded: false,
        };
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        callback = $$.makeSaneCallback(callback);
        options = Object.assign(defaultOpts, options);

        executeMountAwareOperation({
            path: basePath,
            options,
            onIgnoreMounts: () => {
                versionlessDSUController.addFiles(filePaths, basePath, options, callback);
            },
            onMountCallback: (error, {options, archive, relativePath}) => {
                if (error) {
                    return callback(error);
                }
                archive.addFiles(filePaths, relativePath, options, callback);
            },
        });
    };

    this.readFile = (filePath, options, callback) => {
        const defaultOpts = {ignoreMounts: false};
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        callback = $$.makeSaneCallback(callback);
        options = Object.assign(defaultOpts, options);

        executeMountAwareOperation({
            path: filePath,
            options,
            onIgnoreMounts: () => {
                versionlessDSUController.readFile(filePath, callback);
            },
            checkReadonly: false,
            onMountCallback: (error, {options, archive, relativePath}) => {
                if (error) {
                    return callback(error);
                }
                archive.readFile(relativePath, options, callback);
            },
        });
    };

    this.createReadStream = (fileBarPath, options, callback) => {
        callback = getSaneCallbackFunction(fileBarPath, options, callback);
        callback("NotApplicableForVersionlessDSU");
    };

    this.createBigFileReadStreamWithRange = (fileBarPath, range, options, callback) => {
        callback = getSaneCallbackFunction(fileBarPath, range, options, callback);
        callback("NotApplicableForVersionlessDSU");
    };

    this.extractFolder = (fsFolderPath, barPath, options, callback) => {
        callback = getSaneCallbackFunction(fsFolderPath, barPath, options, callback);
        callback("NotImplemented");
    };

    this.extractFile = (fsDestinationFilePath, sourceFilePath, options, callback) => {
        waitIfDSUIsRefreshing(() => {
            const defaultOpts = {ignoreMounts: false};
            if (typeof options === "function") {
                callback = options;
                options = {};
            }

            callback = $$.makeSaneCallback(callback);
            options = Object.assign(defaultOpts, options);

            if (options.ignoreMounts === true) {
                versionlessDSUController.extractFile(fsDestinationFilePath, sourceFilePath, callback);
            } else {
                this.getArchiveForPath(sourceFilePath, (err, archiveContext) => {
                    if (err) {
                        return OpenDSUSafeCallback(callback)(
                            createOpenDSUErrorWrapper(`Failed to load DSU instance mounted at path ${sourceFilePath}`, err)
                        );
                    }

                    options.ignoreMounts = true;
                    archiveContext.archive.extractFile(fsDestinationFilePath, archiveContext.relativePath, options, callback);
                });
            }
        });
    };

    this.extractFolder = (fsDestinationFolderPath, sourceFolderPath, options, callback) => {
        waitIfDSUIsRefreshing(() => {
            const defaultOpts = {ignoreMounts: false};
            if (typeof options === "function") {
                callback = options;
                options = {};
            }

            callback = $$.makeSaneCallback(callback);
            options = Object.assign(defaultOpts, options);

            if (options.ignoreMounts === true) {
                versionlessDSUController.extractFolder(fsDestinationFolderPath, sourceFolderPath, callback);
            } else {
                this.getArchiveForPath(sourceFolderPath, (err, archiveContext) => {
                    if (err) {
                        return OpenDSUSafeCallback(callback)(
                            createOpenDSUErrorWrapper(`Failed to load DSU instance mounted at path ${sourceFolderPath}`, err)
                        );
                    }

                    options.ignoreMounts = true;
                    archiveContext.archive.extractFolder(fsDestinationFolderPath, archiveContext.relativePath, options, callback);
                });
            }
        });
    };

    this.writeFile = (path, data, options, callback) => {
        const defaultOpts = {encrypt: true, ignoreMounts: false, embed: false};
        if (typeof data === "function") {
            callback = data;
            data = undefined;
            options = undefined;
        }
        if (typeof options === "function") {
            callback = options;
            options = defaultOpts;
        }
        if (typeof options === "undefined") {
            options = defaultOpts;
        }

        callback = $$.makeSaneCallback(callback);
        options = Object.assign(defaultOpts, options);

        if (options.embed) {
            options.encrypt = false;
        }

        executeMountAwareOperation({
            path,
            options,
            onIgnoreMounts: () => {
                versionlessDSUController.writeFile(path, data, options, callback);
            },
            onMountCallback: (error, {options, archive, relativePath}) => {
                if (error) {
                    return callback(error);
                }
                archive.writeFile(relativePath, data, options, callback);
            },
        });
    };

    this.embedFile = (path, data, options, callback) => {
        this.writeFile(path, data, options, callback);
    };

    this.writeFileFromBricks = (path, bricks, options, callback) => {
        callback = getSaneCallbackFunction(path, bricks, options, callback);
        callback("NotApplicableForVersionlessDSU");
    };

    this.appendBigFileBrick = (path, newSizeSSI, brick, options, callback) => {
        callback = getSaneCallbackFunction(path, newSizeSSI, brick, options, callback);
        callback("NotApplicableForVersionlessDSU");
    };

    this.getBigFileBricksMeta = (path, options, callback) => {
        callback = getSaneCallbackFunction(path, options, callback);
        callback("NotApplicableForVersionlessDSU");
    };

    this.delete = (path, options, callback) => {
        const defaultOpts = {ignoreMounts: false, ignoreError: false};
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        callback = $$.makeSaneCallback(callback);
        options = Object.assign(defaultOpts, options);

        executeMountAwareOperation({
            path,
            options,
            onIgnoreMounts: () => {
                versionlessDSUController.delete(path, (err) => {
                    if (!err || (err && options.ignoreError)) {
                        return callback();
                    }

                    callback(err);
                });
            },
            onMountCallback: (error, {options, archive, relativePath}) => {
                if (error) {
                    return callback(error);
                }
                archive.delete(relativePath, options, callback);
            },
        });
    };

    this.rename = (srcPath, dstPath, options, callback) => {
        const defaultOpts = {ignoreMounts: false};
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        callback = $$.makeSaneCallback(callback);
        options = Object.assign(defaultOpts, options);

        executeMountAwareOperation({
            path: srcPath,
            options,
            onIgnoreMounts: () => {
                versionlessDSUController.rename(srcPath, dstPath, callback);
            },
            onMountCallback: (error, {options, archive, relativePath, prefixPath}) => {
                if (error) {
                    return callback(error);
                }
                this.getArchiveForPath(dstPath, (err, destinationArchiveContext) => {
                    if (err) {
                        return OpenDSUSafeCallback(callback)(
                            createOpenDSUErrorWrapper(`Failed to load DSU instance mounted at path ${dstPath}`, err)
                        );
                    }

                    if (destinationArchiveContext.prefixPath !== prefixPath) {
                        return callback(Error("Destination is invalid. Renaming must be done in the scope of the same dossier"));
                    }

                    archive.rename(relativePath, destinationArchiveContext.relativePath, options, callback);
                });
            },
        });
    };

    const listMountedEntries = async (dsuEntryType, mountPoints, callback) => {
        const results = [];
        const listEntriesAsync =
            dsuEntryType === DSU_ENTRY_TYPES.FOLDER
                ? $$.promisify(this.listFolders.bind(this))
                : $$.promisify(this.listFiles.bind(this));

        for (const mountPoint of mountPoints) {
            const mountPath = processPath(mountPoint.path);

            try {
                const mountPointEntries = await listEntriesAsync(mountPath, {
                    recursive: true,
                    ignoreMounts: false,
                });
                const mountPointEntryPaths = mountPointEntries.map((file) => {
                    let prefix = mountPath;
                    if (prefix[0] === "/") {
                        prefix = prefix.substring(1);
                    }

                    return processPath(`${prefix}/${file}`);
                });
                mountPointEntryPaths.forEach((path) => results.push(path));
            } catch (error) {
                const entryType = dsuEntryType === DSU_ENTRY_TYPES.FOLDER ? "folders" : "files";
                return OpenDSUSafeCallback(callback)(
                    createOpenDSUErrorWrapper(`Failed to list ${entryType} at path ${mountPath}`, error)
                );
            }
        }

        callback(undefined, results);
    };

    const listMountedFiles = (mountPoints, callback) => {
        listMountedEntries(DSU_ENTRY_TYPES.FILE, mountPoints, callback);
    };

    const listMountedFolders = (mountPoints, callback) => {
        listMountedEntries(DSU_ENTRY_TYPES.FOLDER, mountPoints, callback);
    };

    this.listFiles = (path, options, callback) => {
        const defaultOpts = {ignoreMounts: false, recursive: true};
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        callback = $$.makeSaneCallback(callback);
        options = Object.assign(defaultOpts, options);

        if (options.ignoreMounts === true) {
            if (!options.recursive) {
                return versionlessDSUController.listFiles(path, options, callback);
            }

            return versionlessDSUController.listFiles(path, options, (error, files) => {
                if (error) {
                    return OpenDSUSafeCallback(callback)(
                        createOpenDSUErrorWrapper(`Failed to list files at path ${path}`, error)
                    );
                }

                versionlessDSUController.getMountedDSUs("/", (error, mountPoints) => {
                    if (error) {
                        return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to get manifest`, error));
                    }

                    if (!mountPoints.length) {
                        return callback(undefined, files);
                    }

                    listMountedFiles(mountPoints, (error, mountedFiles) => {
                        if (error) {
                            return OpenDSUSafeCallback(callback)(
                                createOpenDSUErrorWrapper(`Failed to list mounted files at mountPoints ${mountPoints}`, error)
                            );
                        }

                        files = files.concat(...mountedFiles);
                        return callback(undefined, files);
                    });
                });
            });
        }

        this.getArchiveForPath(path, (error, archiveContext) => {
            if (error) {
                return OpenDSUSafeCallback(callback)(
                    createOpenDSUErrorWrapper(`Failed to load DSU instance mounted at path ${path}`, error)
                );
            }

            options.ignoreMounts = true;
            archiveContext.archive.listFiles(archiveContext.relativePath, options, callback);
        });
    };

    this.listFolders = (path, options, callback) => {
        const defaultOpts = {ignoreMounts: false, recursive: false};
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        callback = $$.makeSaneCallback(callback);
        options = Object.assign(defaultOpts, options);

        if (options.ignoreMounts === true) {
            if (!options.recursive) {
                return versionlessDSUController.listFolders(path, options, callback);
            }

            return versionlessDSUController.listFolders(path, options, (error, folders) => {
                if (error) {
                    return OpenDSUSafeCallback(callback)(
                        createOpenDSUErrorWrapper(`Failed to list folders at path ${path}`, error)
                    );
                }

                versionlessDSUController.getMountedDSUs("/", (error, mountPoints) => {
                    if (error) {
                        return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to get manifest`, error));
                    }

                    if (!mountPoints.length) {
                        return callback(undefined, folders);
                    }

                    listMountedFolders(mountPoints, (error, mountedFolders) => {
                        if (error) {
                            return OpenDSUSafeCallback(callback)(
                                createOpenDSUErrorWrapper(`Failed to list mounted folders at mountPoints ${mountPoints}`, error)
                            );
                        }

                        folders = folders.concat(...mountedFolders);
                        return callback(undefined, folders);
                    });
                });
            });
        }

        this.getArchiveForPath(path, (error, archiveContext) => {
            if (error) {
                return OpenDSUSafeCallback(callback)(
                    createOpenDSUErrorWrapper(`Failed to load DSU instance mounted at path ${path}`, error)
                );
            }

            options.ignoreMounts = true;
            archiveContext.archive.listFolders(archiveContext.relativePath, options, callback);
        });
    };

    this.createFolder = (folderPath, options, callback) => {
        const defaultOpts = {ignoreMounts: false, encrypt: true};
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        callback = $$.makeSaneCallback(callback);
        options = Object.assign(defaultOpts, options);

        executeMountAwareOperation({
            path: folderPath,
            options,
            onIgnoreMounts: () => {
                versionlessDSUController.createFolder(folderPath, callback);
            },
            onMountCallback: (error, {options, archive, relativePath}) => {
                if (error) {
                    return callback(error);
                }
                archive.createFolder(relativePath, options, callback);
            },
        });
    };

    this.readDir = (folderPath, options, callback) => {
        const defaultOpts = {withFileTypes: false};
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        callback = $$.makeSaneCallback(callback);
        options = Object.assign(defaultOpts, options);

        this.getArchiveForPath(folderPath, async (err, archiveContext) => {
            if (err) {
                return OpenDSUSafeCallback(callback)(
                    createOpenDSUErrorWrapper(`Failed to load DSU instance mounted at path ${folderPath}`, err)
                );
            }

            const {relativePath, archive} = archiveContext;

            const entries = {};

            try {
                entries.files = await $$.promisify(archive.listFiles.bind(this))(relativePath, {
                    recursive: false,
                    ignoreMounts: true,
                });
            } catch (error) {
                return OpenDSUSafeCallback(callback)(
                    createOpenDSUErrorWrapper(`Failed to list files at path ${relativePath}`, err)
                );
            }

            try {
                const folders = await $$.promisify(archive.listFolders.bind(this))(relativePath, {
                    recursive: false,
                    ignoreMounts: true,
                });

                if (options.withFileTypes) {
                    entries.folders = folders;
                } else {
                    entries.files = [...entries.files, ...folders];
                }
            } catch (error) {
                return OpenDSUSafeCallback(callback)(
                    createOpenDSUErrorWrapper(`Failed to list folders at path ${relativePath}`, err)
                );
            }

            try {
                const mounts = await $$.promisify(archive.listMountedDossiers)(relativePath);

                let mountPaths = mounts.map((mount) => mount.path);
                let folders = mountPaths.filter((mountPath) => mountPath.split("/").length >= 2);
                folders = folders.map((mountPath) => mountPath.split("/").shift());
                let mountedDossiers = mountPaths.filter((mountPath) => mountPath.split("/").length === 1);
                mountedDossiers = mountedDossiers.map((mountPath) => mountPath.split("/").shift());
                if (options.withFileTypes) {
                    entries.mounts = mountedDossiers;
                    entries.folders = Array.from(new Set([...entries.folders, ...folders]));
                    entries.mounts = entries.mounts.filter((mount) => entries.folders.indexOf(mount) === -1);
                    return callback(undefined, entries);
                }
                entries.files = Array.from(new Set([...entries.files, ...mounts, ...folders]));
                return callback(undefined, entries.files);
            } catch (error) {
                return OpenDSUSafeCallback(callback)(
                    createOpenDSUErrorWrapper(`Failed to get mounted DSUs at path ${relativePath}`, error)
                );
            }
        });
    };

    this.cloneFolder = (srcPath, destPath, options, callback) => {
        const defaultOpts = {ignoreMounts: false};
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        callback = $$.makeSaneCallback(callback);
        options = Object.assign(defaultOpts, options);

        executeMountAwareOperation({
            path: srcPath,
            options,
            onIgnoreMounts: () => {
                versionlessDSUController.cloneFolder(srcPath, destPath, callback);
            },
            onMountCallback: (error, {options, archive, relativePath, prefixPath}) => {
                if (error) {
                    return callback(error);
                }
                this.getArchiveForPath(destPath, (err, destinationArchiveContext) => {
                    if (err) {
                        return OpenDSUSafeCallback(callback)(
                            createOpenDSUErrorWrapper(`Failed to load DSU instance mounted at path ${destPath}`, err)
                        );
                    }

                    if (destinationArchiveContext.prefixPath !== prefixPath) {
                        return callback(Error("Destination is invalid. Renaming must be done in the scope of the same dossier"));
                    }

                    archive.cloneFolder(relativePath, destinationArchiveContext.relativePath, options, callback);
                });
            },
        });
    };

    this.mount = (path, identifier, options, callback) => {
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        callback = $$.makeSaneCallback(callback);

        function internalMount() {
            versionlessDSUController.listFiles(path, {}, (err, files) => {
                if (!err && files.length > 0) {
                    return callback(Error("Tried to mount in a non-empty folder"));
                }
                // archiveContext.archive.mount(archiveContext.relativePath, identifier, options, callback);
                versionlessDSUController.mount(path, identifier, options, callback);
            });
        }

        this.getArchiveForPath(path, (err, archiveContext) => {
            if (err) {
                return OpenDSUSafeCallback(callback)(
                    createOpenDSUErrorWrapper(`Failed to load DSU instance mounted at path ${path}`, err)
                );
            }
            if (archiveContext.relativePath === processPath(path)) {
                internalMount();
            } else {
                archiveContext.archive.mount(archiveContext.relativePath, identifier, options, callback);
            }
        });
    };

    this.unmount = (path, callback) => {
        callback = $$.makeSaneCallback(callback);
        versionlessDSUController.unmount(path, callback);
    };

    this.listMountedDossiers = (path, callback) => {
        callback = $$.makeSaneCallback(callback);

        this.getArchiveForPath(path, (err, archiveContext) => {
            if (err) {
                return OpenDSUSafeCallback(callback)(
                    createOpenDSUErrorWrapper(`Failed to load DSU instance mounted at path ${path}`, err)
                );
            }
            if (archiveContext.archive === this) {
                versionlessDSUController.getMountedDSUs(path, callback);
            } else {
                archiveContext.archive.listMountedDossiers(archiveContext.relativePath, callback);
            }
        });
    };
    this.listMountedDSUs = this.listMountedDossiers;

    this.hasUnanchoredChanges = (callback) => {
        callback("NotImplemented");
    };

    this.getArchiveForPath = (path, callback) => {
        callback = $$.makeSaneCallback(callback);
        versionlessDSUController.getArchiveContextForPath(path, callback);
    };

    /**
     * Start a batch of operations
     * This will force the persist changes when the
     * batch is commited
     */
    this.beginBatch = () => {
        if (this.batchInProgress()) {
            throw new Error("Another anchoring transaction is already in progress. Cancel the previous batch and try again.");
        }

        versionlessDSUController.beginBatch();
        return generateBatchId(false);
    };

    /**
     * Start a batch of operations
     * This will force the persist changes when the
     * batch is commited
     */
    this.startOrAttachBatch = (callback) => {
        if (this.batchInProgress()) {
            throw new Error("Another anchoring transaction is already in progress. Cancel the previous batch and try again.");
        }
        let batchId;
        try {
            batchId = this.beginBatch();
        } catch (e) {
            return callback(e);
        }

        callback(undefined, batchId);
    };


    this.startOrAttachBatchAsync = async () => {
        return $$.promisify(this.startOrAttachBatch, this)();
    }

    this.batchInProgress = () => {
        return versionlessDSUController.isBatchInProgress();
    };

    //just an alias due to LegacyDSU apis
    this.safeBeginBatch = (wait, callback) => {
        if (typeof callback === "undefined") {
            callback = wait;
            wait = undefined;
        }
        if (typeof wait !== "undefined") {
            console.trace("\n\n VersionLessDSU.safeBeginBatch was called with wait argument and this is ignored for the moment \n\n");
        }
        try {
            this.beginBatch();
            callback(undefined, true);
        } catch (err) {
            callback(err, false);
        }
    };

    this.safeBeginBatchAsync = async (wait) => {
        return $$.promisify(this.safeBeginBatch, this)(wait);
    }

    /**
     * Persist batch of changes
     * @param {callback} onConflict defined by StandardDSU interface
     * @param {callback} callback
     */
    this.commitBatch = (onConflict, callback) => {
        if (typeof callback === "undefined") {
            callback = onConflict;
            onConflict = undefined;
        }

        callback = $$.makeSaneCallback(callback);
        if (!this.batchInProgress()) {
            return callback(new Error("No batch operations have been scheduled"));
        }

        versionlessDSUController.commitBatch(callback);
    };

    this.commitBatchAsync = async (...args) => {
        return $$.promisify(this.commitBatch, this)(...args);
    }

    /**
     * Cancel the current persisting batch
     */
    this.cancelBatch = (callback) => {
        callback = $$.makeSaneCallback(callback);
        if (!this.batchInProgress()) {
            return callback(new Error("No batch operations have been scheduled"));
        }

        versionlessDSUController.cancelBatch(callback);
    };

    this.cancelBatchAsync = async () => {
        return $$.promisify(this.cancelBatch, this)();
    }

    /**
     * Execute a batch of operations
     * then anchor the changes
     *
     * @param {function} batch
     * @param {callback} callback
     */
    this.batch = (batch, callback) => {
        this.beginBatch();
        batch((error) => {
            if (error) {
                callback = $$.makeSaneCallback(callback);
                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to execute batch operations`, error));
            }

            this.commitBatch(callback);
        });
    };

    this.setMergeConflictsHandler = () => {
        throw new Error("NotApplicableForVersionlessDSU");
    };

    this.enableAnchoringNotifications = (status, options, callback) => {
        callback = getSaneCallbackFunction(status, options, callback);
        callback("NotApplicableForVersionlessDSU");
    };

    this.enableAutoSync = (status, options, callback) => {
        callback = getSaneCallbackFunction(status, options, callback);
        callback("NotImplemented");
    };

    this.stat = (path, callback) => {
        callback = $$.makeSaneCallback(callback);

        this.getArchiveForPath(path, (error, archiveContext) => {
            if (error) {
                return callback(undefined, {type: undefined});
            }
            if (archiveContext.archive === this) {
                versionlessDSUController.stat(path, callback);
            } else {
                archiveContext.archive.stat(archiveContext.relativePath, callback);
            }
        });
    };
}

module.exports = VersionlessDSU;
