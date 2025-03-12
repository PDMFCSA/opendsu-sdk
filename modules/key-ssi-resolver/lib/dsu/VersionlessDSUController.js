const VersionlessDSUContentHandler = require("./VersionlessDSUContentHandler");

function VersionlessDSUController(versionlessDSU, config) {
    this.versionlessDSU = versionlessDSU;
    const {keySSIObject} = config;
    let isEncrypted = keySSIObject.isEncrypted();

    const openDSU = require("opendsu");
    const crypto = openDSU.loadAPI("crypto");
    const {SmartUrl} = openDSU.loadAPI("utils");
    const bdns = openDSU.loadApi("bdns");

    const dlDomain = keySSIObject.getDLDomain();

    let versionlessFilePath = keySSIObject.getFilePath();

    let apihubBaseUrl;
    if (!dlDomain || dlDomain.toUpperCase() === bdns.getOriginPlaceholder()) {
        apihubBaseUrl = bdns.getOrigin();
    } else {
        apihubBaseUrl = dlDomain;
    }

    const encryptAsync = $$.promisify(keySSIObject.encrypt);
    const decryptAsync = $$.promisify(keySSIObject.decrypt);

    // current DSU content
    this.dsuContent = null;

    let isBatchCurrentlyInProgress = false;
    let isPersistChangesNeeded = false;
    let dsuContentBeforeBatchChanges = null;
    const mountedArchivesForBatchOperations = [];

    const getContentHandler = () => {
        return new VersionlessDSUContentHandler(this.versionlessDSU, this.dsuContent);
    };

    const resetBatchCurrentlyInProgress = () => {
        isBatchCurrentlyInProgress = false;
        isPersistChangesNeeded = false;
    };

    const persistDSU = async () => {
        let smartUrl = new SmartUrl(apihubBaseUrl);
        let path = "/versionlessdsu";
        if (versionlessFilePath.startsWith("/")) {
            path = path.concat(versionlessFilePath);
        } else {
            path = path.concat("/").concat(versionlessFilePath);
        }
        smartUrl = smartUrl.concatWith(path);

        let requestBody = JSON.stringify(this.dsuContent);

        if (isEncrypted) {
            try {
                requestBody = await encryptAsync(requestBody);
            } catch (error) {
                createOpenDSUErrorWrapper(`Failed to encrypt versionless DSU content`, error);
            }
        }

        requestBody = crypto.base64URLEncode(requestBody);
        return $$.promisify(smartUrl.doPut)(requestBody);
    };

    const persistChanges = async (callback) => {
        if (this.isBatchInProgress()) {
            // don't persist changes until batch is commited
            isPersistChangesNeeded = true;
            return callback();
        }

        try {
            const result = await persistDSU();
            callback(undefined, result);
        } catch (error) {
            OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to persist versionless DSU changes`, error));
        }
    };

    this.createDSU = async (callback) => {
        this.dsuContent = {
            folders: {},
            files: {}
        };

        try {
            await persistDSU();
            // return VersionlessDSU instance
            callback(undefined, this);
        } catch (error) {
            OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to create versionless DSU changes`, error));
        }
    };

    this.loadDSU = async (callback) => {
        const loadDSU = () => {
            let smartUrl = new SmartUrl(apihubBaseUrl);
            let path = "/versionlessdsu";
            if (versionlessFilePath.startsWith("/")) {
                path = path.concat(versionlessFilePath);
            } else {
                path = path.concat("/").concat(versionlessFilePath);
            }
            smartUrl = smartUrl.concatWith(path);
            return smartUrl.fetch().then((response) => response.text());
        };

        try {
            let result = await loadDSU();
            result = crypto.base64URLDecode(result);
            if (isEncrypted) {
                try {
                    result = await decryptAsync(result);
                } catch (error) {
                    return OpenDSUSafeCallback(callback)(
                        createOpenDSUErrorWrapper(`Failed to decrypt versionless DSU content`, error)
                    );
                }
            }

            if (typeof result === "string" || $$.Buffer.isBuffer(result)) {
                result = JSON.parse(result);
            }

            this.dsuContent = result;
            callback(undefined, this);
        } catch (error) {
            OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to get versionless DSU`, error));
        }
    };

    this.appendToFile = (path, data, options, callback) => {
        const contentHandler = getContentHandler();
        contentHandler.appendToFile(path, data, options);
        persistChanges(callback);
    };

    this.getSSIForMount = (mountPoint, callback) => {
        const contentHandler = getContentHandler();
        const ssi = contentHandler.getSSIForMount(mountPoint);
        if (!ssi) {
            return callback(Error(`No mount found at path ${mountPoint}`));
        }
        callback(undefined, ssi);
    };

    this.addFolder = (folderPath, basePath, options, callback) => {
        const contentHandler = getContentHandler();
        const addFolderCallback = (error) => {
            if (error) {
                return callback(error);
            }
            persistChanges(callback);
        };
        contentHandler.addFolder(folderPath, basePath, addFolderCallback);
    };

    this.addFile = (sourceFilePath, destinationFilePath, options, callback) => {
        const contentHandler = getContentHandler();
        const addFileCallback = (error) => {
            if (error) {
                return callback(error);
            }
            persistChanges(callback);
        };
        contentHandler.addFile(sourceFilePath, destinationFilePath, addFileCallback);
    };

    this.addFiles = (filePaths, basePath, options, callback) => {
        const contentHandler = getContentHandler();
        const addFilesCallback = (error) => {
            if (error) {
                return callback(error);
            }
            persistChanges(callback);
        };
        contentHandler.addFiles(filePaths, basePath, addFilesCallback);
    };

    this.extractFile = (fsDestinationFilePath, sourceFilePath, callback) => {
        const contentHandler = getContentHandler();
        contentHandler.extractFile(fsDestinationFilePath, sourceFilePath, callback);
    };

    this.extractFolder = (fsDestinationFolderPath, sourceFolderPath, callback) => {
        const contentHandler = getContentHandler();
        contentHandler.extractFolder(fsDestinationFolderPath, sourceFolderPath, callback);
    };

    this.readFile = (filePath, callback) => {
        const contentHandler = getContentHandler();
        try {
            const buffer = contentHandler.readFile(filePath);
            callback(undefined, buffer);
        } catch (error) {
            return callback(error);
        }
    };

    this.writeFile = (path, data, options, callback) => {
        const contentHandler = getContentHandler();
        contentHandler.writeFile(path, data, options);
        persistChanges(callback);
    };

    this.delete = (path, callback) => {
        const contentHandler = getContentHandler();

        try {
            contentHandler.delete(path);
        } catch (error) {
            return callback(error);
        }

        persistChanges(callback);
    };

    this.rename = (sourcePath, destinationPath, callback) => {
        const contentHandler = getContentHandler();

        try {
            contentHandler.rename(sourcePath, destinationPath);
        } catch (error) {
            return callback(error);
        }

        persistChanges(callback);
    };

    this.listFiles = (path, options, callback) => {
        const contentHandler = getContentHandler();
        const files = contentHandler.getFiles(path, options.recursive);
        callback(null, files);
    };

    this.listFolders = (path, options, callback) => {
        const contentHandler = getContentHandler();
        const folders = contentHandler.getFolders(path, options.recursive);
        callback(null, folders);
    };

    this.createFolder = (path, callback) => {
        const contentHandler = getContentHandler();
        contentHandler.createFolder(path);
        persistChanges(callback);
    };

    this.cloneFolder = (sourcePath, destinationPath, callback) => {
        const contentHandler = getContentHandler();

        try {
            contentHandler.cloneFolder(sourcePath, destinationPath);
        } catch (error) {
            return callback(error);
        }

        persistChanges(callback);
    };

    this.mount = (path, identifier, options, callback) => {
        const contentHandler = getContentHandler();

        try {
            contentHandler.validatePathToMount(path);
        } catch (error) {
            return callback(error);
        }

        contentHandler.mount(path, identifier, options);
        persistChanges(callback);
    };
    this.unmount = (path, callback) => {
        const contentHandler = getContentHandler();

        try {
            contentHandler.unmount(path);
        } catch (error) {
            return callback(error);
        }

        persistChanges(callback);
    };

    this.getMountedDSUs = (path, callback) => {
        const contentHandler = getContentHandler();
        const mountedDSUs = contentHandler.getMountedDSUs(path);
        callback(undefined, mountedDSUs);
    };

    this.getArchiveContextForPath = (path, callback) => {
        const contentHandler = getContentHandler();

        contentHandler.getArchiveContextForPath(path, (error, archiveContext) => {
            if (error) {
                return callback(error);
            }

            if (archiveContext.archive === this.versionlessDSU || !this.isBatchInProgress()) {
                return callback(undefined, archiveContext);
            }

            archiveContext.archive.getKeySSIAsString((err, keySSI) => {
                if (err) {
                    return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper("Failed to retrieve keySSI", err));
                }

                const cachedArchive = mountedArchivesForBatchOperations.find((archive) => {
                    return archive.identifier === keySSI;
                });

                if (cachedArchive) {
                    cachedArchive.relativePath = archiveContext.relativePath;
                    return callback(undefined, cachedArchive);
                }

                archiveContext.identifier = keySSI;
                archiveContext.archive.beginBatch();
                mountedArchivesForBatchOperations.push(archiveContext);

                callback(undefined, archiveContext);
            });
        });
    };

    this.beginBatch = () => {
        isBatchCurrentlyInProgress = true;
        isPersistChangesNeeded = false;
        dsuContentBeforeBatchChanges = this.dsuContent;
    };

    this.isBatchInProgress = () => {
        return isBatchCurrentlyInProgress;
    };

    const runBatchActionInMountedArchives = async (batchActionName, callback) => {
        const archivesForBatch = [...mountedArchivesForBatchOperations];
        archivesForBatch.reverse();

        const results = [];
        for (const archiveContext of archivesForBatch) {
            try {
                const result = await $$.promisify(archiveContext.archive[batchActionName].bind(archiveContext.archive))();
                results.push(result);
            } catch (error) {
                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper("Failed to commit batch", error));
            }
        }

        callback(undefined, results);
    };

    this.commitBatch = (callback) => {
        runBatchActionInMountedArchives("commitBatch", (error) => {
            if (error) {
                resetBatchCurrentlyInProgress();
                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to anchor`, error));
            }

            isBatchCurrentlyInProgress = false;
            persistChanges((error) => {
                resetBatchCurrentlyInProgress();
                if (error) {
                    return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to anchor`, error));
                }

                callback(undefined);
            });
        });
    };

    this.cancelBatch = (callback) => {
        runBatchActionInMountedArchives("cancelBatch", (error) => {
            if (error) {
                return OpenDSUSafeCallback(callback)(
                    createOpenDSUErrorWrapper(`Failed to cancel batches in mounted archive`, error)
                );
            }

            resetBatchCurrentlyInProgress();
            if (dsuContentBeforeBatchChanges) {
                this.dsuContent = dsuContentBeforeBatchChanges;
                dsuContentBeforeBatchChanges = null;
            }
            // ensure we have the latest version by loading the DSU again
            this.loadDSU((error) => {
                if (error) {
                    return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to load current DSU`, error));
                }
                callback();
            });
        });
    };

    this.stat = (path, callback) => {
        const contentHandler = getContentHandler();
        const result = contentHandler.stat(path);
        callback(undefined, result);
    };
}

module.exports = VersionlessDSUController;
