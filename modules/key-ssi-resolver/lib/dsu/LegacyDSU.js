let DSUSIntaceNo = 0;
let BatchInstacesNo = 0;

function LegacyDSU(bar, dsuInstancesRegistry) {
    let opendsu = require("opendsu");
    let keySSISpace = opendsu.loadAPI("keyssi");
    const resolver = opendsu.loadAPI("resolver");
    let instanceUid = "DSU NOT Ready";
    let dsuAnchorId = keySSISpace.parse(bar.getAnchorIdSync()).getIdentifier(true);

    this.getInstanceUID = () => {
        if (instanceUid == "DSU NOT Ready") {
            DSUSIntaceNo++
            instanceUid = `DSU${DSUSIntaceNo}`;
        }
        return instanceUid;
    }

    this.getAnchorIdSync = () => {
        return dsuAnchorId;
    }

    this.getAnchorId = (callback) => {
        bar.getAnchorId(callback);
    }

    $$.debug.logDSUEvent(this, "created");

    let inProgressBatches = new Set();

    const convertUpdateFnToAsync = (updateFn, ...args) => {
        if (!this.batchInProgress()) {
            throw Error("No batch has been started");
        }

        return $$.promisify(updateFn)(...args);
    }

    this.setBarInstance = (_barInstance) => {
        bar = _barInstance;
        $$.debug.logDSUEvent(this, "bar instance set");
    }

    this.getBarInstance = () => {
        return bar;
    }

    this.load = (callback) => {
        bar.load(callback);
    }

    this.loadAsync = async () => {
        return convertUpdateFnToAsync(this.load);
    }

    this.hasNewVersion = (callback) => {
        bar.hasNewVersion(callback);
    }

    this.loadVersion = (versionHash, callback) => {
        bar.loadVersion(versionHash, callback);
    }

    this.loadVersionAsync = async (versionHash) => {
        return convertUpdateFnToAsync(this.loadVersion, versionHash);
    }

    this.getLastHashLinkSSI = (callback) => {
        bar.getLastHashLinkSSI(callback);
    }

    this.getLastHashLinkSSIAsync = async (...args) => {
        return $$.promisify(this.getLastHashLinkSSI, this)(...args);
    }

    this.getLatestAnchoredHashLink = (callback) => {
        bar.getLatestAnchoredHashLink(callback);
    }

    this.getLatestAnchoredHashLinkAsync = async (...args) => {
        return $$.promisify(this.getLatestAnchoredHashLink, this)(...args);
    }

    this.getCurrentAnchoredHashLink = (callback) => {
        bar.getCurrentAnchoredHashLink(callback);
    }

    this.getCurrentAnchoredHashLinkAsync = async (...args) => {
        return $$.promisify(this.getCurrentAnchoredHashLink, this)(...args);
    }

    this.getKeySSI = (keySSIType, callback) => {
        bar.getKeySSI(keySSIType, callback);
    }

    this.getKeySSIAsync = async (keySSIType) => {
        return $$.promisify(this.getKeySSI, this)(keySSIType);
    }

    this.getKeySSIAsObject = (keySSIType, callback) => {
        bar.getKeySSIAsObject(keySSIType, callback);
    }

    this.getKeySSIAsObjectAsync = async (keySSIType) => {
        return $$.promisify(this.getKeySSIAsObject, this)(keySSIType);
    }

    this.getKeySSIAsString = (keySSIType, callback) => {
        bar.getKeySSIAsString(keySSIType, callback);
    }

    this.getKeySSIAsStringAsync = async (keySSIType) => {
        return $$.promisify(this.getKeySSIAsString, this)(keySSIType);
    }

    this.getCreationSSI = (plain) => {
        return bar.getCreationSSI(plain);
    }

    this.getUniqueIdAsync = async () => {
        return await bar.getUniqueIdAsync();
    }


    this.addFiles = (files, barPath, options, callback) => {
        preventUpdateOutsideBatch(bar.addFiles, files, barPath, options, callback);
    }

    this.addFilesAsync = async (files, barPath, options) => {
        return convertUpdateFnToAsync(this.addFiles, files, barPath, options);
    }

    this.appendToFile = (barPath, data, options, callback) => {
        preventUpdateOutsideBatch(bar.appendToFile, barPath, data, options, callback);
    }

    this.appendToFileAsync = async (barPath, data, options) => {
        return convertUpdateFnToAsync(this.appendToFile, barPath, data, options);
    }

    this.dsuLog = (message, callback) => {
        bar.dsuLog(message, callback);
        // preventUpdateOutsideBatch(bar.dsuLog, message, callback);
    }

    this.dsuLogAsync = async (message) => {
        return convertUpdateFnToAsync(this.dsuLog, message);
    }

    this.setValidationRules = (rules) => {
        bar.setValidationRules(rules);
    }

    this.setAnchoringEventListener = (listener) => {
        bar.setAnchoringEventListener(listener);
    }

    this.setDecisionCallback = (callback) => {
        bar.setDecisionCallback(callback);
    }

    this.getAnchoringStrategy = () => {
        return bar.getAnchoringStrategy();
    }

    this.addFolder = (fsFolderPath, barPath, options, callback) => {
        if (typeof options === "function") {
            callback = options;
            options = undefined;
        }

        preventUpdateOutsideBatch(bar.addFolder, fsFolderPath, barPath, options, callback);
    }

    this.addFolderAsync = async (fsFolderPath, barPath, options) => {
        return convertUpdateFnToAsync(this.addFolder, fsFolderPath, barPath, options);
    }

    this.addFile = (fsFilePath, barPath, options, callback) => {
        if (typeof options === "function") {
            callback = options;
            options = undefined;
        }

        preventUpdateOutsideBatch(bar.addFile, fsFilePath, barPath, options, callback);
    }

    this.addFileAsync = async (fsFilePath, barPath, options) => {
        return convertUpdateFnToAsync(this.addFile, fsFilePath, barPath, options);
    }

    this.readFile = (fileBarPath, options, callback) => {
        bar.readFile(fileBarPath, options, callback)
    }

    this.readFileAsync = async (...args) => {
        return $$.promisify(this.readFile, this)(...args);
    }

    this.createReadStream = (fileBarPath, options, callback) => {
        bar.createReadStream(fileBarPath, options, callback);
    }

    this.createReadStreamAsync = async (...args) => {
        return $$.promisify(this.createReadStream, this)(...args);
    }

    this.createBigFileReadStreamWithRange = (fileBarPath, range, options, callback) => {
        bar.createBigFileReadStreamWithRange(fileBarPath, range, options, callback);
    }

    this.createBigFileReadStreamWithRangeAsync = async (...args) => {
        return $$.promisify(this.createBigFileReadStreamWithRange, this)(...args);
    }

    this.extractFolder = (fsFolderPath, barPath, options, callback) => {
        bar.extractFolder(fsFolderPath, barPath, options, callback);
    }

    this.extractFolderAsync = async (...args) => {
        return $$.promisify(this.extractFolder, this)(...args);
    }

    this.extractFile = (fsFilePath, barPath, options, callback) => {
        bar.extractFile(fsFilePath, barPath, options, callback);
    }

    this.extractFileAsync = async (...args) => {
        return $$.promisify(this.extractFile, this)(...args);
    }

    const preventUpdateOutsideBatch = (updateFn, ...args) => {
        if ($$.LEGACY_BEHAVIOUR_ENABLED) {
            return updateFn(...args);
        }

        if (!this.batchInProgress()) {
            const callback = args.pop();
            return callback(Error("Batch not started. Use safeBeginBatch() or safeBeginBatchAsync before calling this method."));
        }

        updateFn(...args);
    }

    this.writeFile = (path, data, options, callback) => {
        if (typeof data === "function") {
            callback = data;
            data = undefined;
            options = undefined;
        }

        if (typeof options === "function") {
            callback = options;
            options = undefined;
        }

        preventUpdateOutsideBatch(bar.writeFile, path, data, options, callback);
    }

    this.writeFileAsync = async (path, data, options) => {
        return convertUpdateFnToAsync(this.writeFile, path, data, options);
    }

    this.embedFile = (path, data, options, callback) => {
        if (typeof data === "function") {
            callback = data;
            data = undefined;
            options = undefined;
        }

        if (typeof options === "function") {
            callback = options;
            options = undefined;
        }

        preventUpdateOutsideBatch(bar.embedFile, path, data, options, callback);
    }

    this.embedFileAsync = async (path, data, options) => {
        return convertUpdateFnToAsync(this.embedFile, path, data, options);
    }

    this.writeFileFromBricks = (path, bricks, options, callback) => {
        bar.writeFileFromBricks(path, bricks, options, callback);
    }

    this.writeFileFromBricksAsync = async (path, bricks, options) => {
        return convertUpdateFnToAsync(this.writeFileFromBricks, path, bricks, options);
    }

    this.appendBigFileBrick = (path, newSizeSSI, brick, options, callback) => {
        if (typeof options === "function") {
            callback = options;
            options = undefined;
        }

        preventUpdateOutsideBatch(bar.appendBigFileBrick, path, newSizeSSI, brick, options, callback);
    }

    this.appendBigFileBrickAsync = async (path, newSizeSSI, brick, options) => {
        return convertUpdateFnToAsync(this.appendBigFileBrick, path, newSizeSSI, brick, options);
    }

    this.getBigFileBricksMeta = (path, options, callback) => {
        bar.getBigFileBricksMeta(path, options, callback)
    }

    this.delete = (path, options, callback) => {
        if (typeof options === "function") {
            callback = options;
            options = undefined;
        }

        preventUpdateOutsideBatch(bar.delete, path, options, callback);
    }

    this.deleteAsync = async (path, options) => {
        return convertUpdateFnToAsync(this.delete, path, options);
    }

    this.rename = (srcPath, dstPath, options, callback) => {
        if (typeof options === "function") {
            callback = options;
            options = undefined;
        }

        preventUpdateOutsideBatch(bar.rename, srcPath, dstPath, options, callback);
    }

    this.renameAsync = async (srcPath, dstPath, options) => {
        return convertUpdateFnToAsync(this.rename, srcPath, dstPath, options);
    }

    this.listFiles = (path, options, callback) => {
        bar.listFiles(path, options, callback);
    }

    this.listFolders = (path, options, callback) => {
        bar.listFolders(path, options, callback);
    }

    this.createFolder = (barPath, options, callback) => {
        if (typeof options === "function") {
            callback = options;
            options = undefined;
        }

        preventUpdateOutsideBatch(bar.createFolder, barPath, options, callback);
    }

    this.createFolderAsync = async (barPath, options) => {
        return convertUpdateFnToAsync(this.createFolder, barPath, options);
    }

    this.readDir = (folderPath, options, callback) => {
        bar.readDir(folderPath, options, callback);
    }

    this.readDirAsync = async (...args) => {
        return $$.promisify(this.readDir, this)(...args);
    }

    this.cloneFolder = (srcPath, destPath, options, callback) => {
        if (typeof options === "function") {
            callback = options;
            options = undefined;
        }

        preventUpdateOutsideBatch(bar.cloneFolder, srcPath, destPath, options, callback);
    }

    this.cloneFolderAsync = async (srcPath, destPath, options) => {
        return convertUpdateFnToAsync(this.cloneFolder, srcPath, destPath, options);
    }

    this.mount = (path, archiveSSI, options, callback) => {
        if (typeof options === "function") {
            callback = options;
            options = undefined;
        }

        preventUpdateOutsideBatch(bar.mount, path, archiveSSI, options, callback);
    }

    this.mountAsync = async (path, archiveSSI, options) => {
        return convertUpdateFnToAsync(this.mount, path, archiveSSI, options);
    }

    this.unmount = (path, callback) => {
        preventUpdateOutsideBatch(bar.unmount, path, callback);
    };

    this.unmountAsync = async (path) => {
        return convertUpdateFnToAsync(this.unmount, path);
    }

    this.listMountedDSUs = (path, callback) => {
        bar.listMountedDSUs(path, callback);
    };

    this.listMountedDSUsAsync = async (...args) => {
        return $$.promisify(this.listMountedDSUs, this)(...args);
    }

    this.listMountedDossiers = this.listMountedDSUs;

    this.hasUnanchoredChanges = (callback) => {
        bar.hasUnanchoredChanges(callback);
    }

    this.hasUnanchoredChangesAsync = async (...args) => {
        return $$.promisify(this.hasUnanchoredChanges, this)(...args);
    }

    this.getArchiveForPath = (path, callback) => {
        bar.getArchiveForPath(path, callback);
    }

    this.getArchiveForPathAsync = async (...args) => {
        return $$.promisify(this.getArchiveForPath, this)(...args);
    }

    this.stat = (path, callback) => {
        bar.stat(path, callback);
    }

    this.statAsync = async (...args) => {
        return $$.promisify(this.stat, this)(...args);
    }

    let _beginBatch = (isVirtual, callback) => {
        let initBatch = (isVirtualBeginBatch) => {
            try {
                if (!isVirtualBeginBatch) {
                    this.beginBatchAsync().then((batchId) => {
                        return callback(undefined, batchId);
                    }).catch((err) => {
                        return callback(err);
                    });
                } else {
                    return startVirtualBatch(callback);
                }
            } catch (err) {
                return callback(err);
            }
        }

        let anchorId = dsuAnchorId;
        if (dsuInstancesRegistry.isLocked(anchorId)) {
            dsuInstancesRegistry.waitUntilCanBeginBatch(anchorId, initBatch, this);
            return;
        }

        initBatch(isVirtual);
    }

    let startVirtualBatch = (callback) => {
        let attachedBatchId = generateBatchId(true);
        inProgressBatches.add(attachedBatchId);
        $$.debug.logDSUEvent(this, "Virtual batch started", attachedBatchId);
        return callback(undefined, attachedBatchId);
    }

    const atLeastOneMountedDSUIsInBatchMode = async () => {
        const keySSISpace = require("opendsu").loadAPI("keyssi");
        const mountedDSUs = await $$.promisify(this.listMountedDSUs)("/");
        for (const mountedDSU of mountedDSUs) {
            const anchorId = await $$.promisify(keySSISpace.parse(mountedDSU.identifier).getAnchorId)(true);
            if (dsuInstancesRegistry.batchInProgress(anchorId)) {
                return true;
            }
        }
        return false;
    }

    const parentDSUIsInBatchMode = async () => {
        const anchorId = this.getAnchorIdSync();
        const instances = dsuInstancesRegistry.getAllInstances();
        for (let dsuInstance of instances) {
            if (dsuInstance.batchInProgress()) {
                const mountedDSUs = await $$.promisify(dsuInstance.listMountedDSUs)("/");
                for (const mountedDSU of mountedDSUs) {
                    const mountedDSUAnchorId = await $$.promisify(keySSISpace.parse(mountedDSU.identifier).getAnchorId)(true);
                    if (mountedDSUAnchorId === anchorId) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    this.safeBeginBatch = (wait, callback) => {
        $$.debug.logDSUEvent(this, "safeBeginBatch called", wait);
        if (typeof wait === "function") {
            callback = wait;
            wait = false;
        }
        if (bar.batchInProgress()) {
            console.warn(Error("This DSU instance is already in batch mode when called safeBeginBatch!"));
            return startVirtualBatch(callback);
        }

        let _safeBeginBatch = (isVirtual) => {
            let {
                testIfRecoveryActiveFor
            } = opendsu.loadApi("anchoring").getAnchoringX();

            if (testIfRecoveryActiveFor(dsuAnchorId)) {
                return _beginBatch(isVirtual, callback);
            }

            this.refresh((err) => {
                if (err) {
                    return callback(err);
                }
                return _beginBatch(isVirtual, callback);
            });
        }

        if (dsuInstancesRegistry.batchInProgress(this.getAnchorIdSync())) {
            if (wait) {
                dsuInstancesRegistry.waitUntilCanBeginBatch(dsuAnchorId, _safeBeginBatch, this);
                return;
            }
            return callback(Error("Another DSU instance is already in batch mode. Please wait for it to finish."));
        }

        _safeBeginBatch();
    }
    this.safeBeginBatchAsync = async (...args) => {
        return $$.promisify(this.safeBeginBatch, this)(...args);
    }

    this.startOrAttachBatch = (callback) => {
        $$.debug.logDSUEvent(this, "startOrAttachBatch called");
        console.debug("startOrAttachBatch called");
        if (!this.batchInProgress && dsuInstancesRegistry.batchInProgress(this.getAnchorIdSync())) {
            return callback(Error("Another instance of the LegacyDSU is currently in batch."));
        }
        this.getKeySSIAsObject((err, keySSI) => {
            if (err) {
                return callback(err);
            }

            if (keySSI.getFamilyName() === opendsu.constants.KEY_SSI_FAMILIES.CONST_SSI) {
                return resolver.dsuExists(keySSI, (err, exists) => {
                    if (err) {
                        return callback(err);
                    }

                    if (exists) {
                        return callback(Error("An anchored ConstDSU cannot be put in batch mode."));
                    }

                    if (!this.batchInProgress()) {
                        return this.beginBatch(callback);
                    }

                    if (dsuInstancesRegistry.batchInProgress(this.getAnchorIdSync())) {
                        return callback(Error("Another instance of the LegacyDSU is currently in batch."));
                    }

                    return _beginBatch(false, callback);
                })
            }
        });

        if (this.batchInProgress()) {
            return startVirtualBatch(callback);
        }

        return _beginBatch(false, callback);
    }

    this.startOrAttachBatchAsync = async () => {
        return $$.promisify(this.startOrAttachBatch, this)();
    }

    function generateBatchId(isVirtual) {
        BatchInstacesNo++;
        if (isVirtual) {
            return `VB:${BatchInstacesNo}`
        } else {
            return `RB:${BatchInstacesNo}`
        }
    }

    this.beginBatch = () => {
        console.info("Synchronous version of beginBatch will be removed in the future (2025). Please use safeBeginBatch or safeBeginBatchAsync instead");
        let anchorId = dsuAnchorId;
        if (dsuInstancesRegistry.isLocked(anchorId)) {
            console.trace("anchor is Locked");
            throw Error(`AnchorId is locked`);
        }
        bar.beginBatch();
        const batchId = generateBatchId(false);
        inProgressBatches.add(batchId);
        $$.debug.logDSUEvent(this, "Real batch started", batchId);
        console.debug(`Real batch started ${batchId}`);
        return batchId;
    }

    this.beginBatchAsync = async () => {
        let anchorId = dsuAnchorId;
        if (dsuInstancesRegistry.isLocked(anchorId)) {
            console.trace("anchor is Locked");
            throw Error(`AnchorId is locked`);
        }
        const isMountedDSUInBatchMode = await atLeastOneMountedDSUIsInBatchMode();
        if (isMountedDSUInBatchMode) {
            throw Error("At least one mounted DSU is in batch mode");
        }

        if (await parentDSUIsInBatchMode()) {
            throw Error("Parent DSU is in batch mode");
        }
        bar.beginBatch();
        const batchId = generateBatchId(false);
        inProgressBatches.add(batchId);
        $$.debug.logDSUEvent(this, "Real batch started", batchId);
        console.debug(`Real batch started ${batchId}`);
        return batchId;
    }

    this.batch = async (batch, callback) => {
        bar.batch(batch, callback);
        /*let error, batchResult, batchId;
        try{
            batchId = await this.startOrAttachBatchAsync();
            let batchMethod = $$.promisify(bar.batch, bar);
            batchResult = await batchMethod(batch);
            await this.commitBatchAsync(batchId);
        }catch(err){
            error = err;
            await this.cancelBatchAsync(batchId);
        }

        callback(error, batchResult);*/
    }

    this.batchInProgress = () => {
        return !!inProgressBatches.size;
    }

    this.cancelBatch = (batchId, callback) => {

        if (typeof batchId === "function") {
            callback = batchId;
            batchId = undefined;
        }

        if (inProgressBatches.size === 0) {
            console.warn(Error("Unable to cancel a batch that seems to not be in batch mode"));
            return callback(undefined, undefined);
        }

        if (!batchId && inProgressBatches.size > 1) {
            console.warn(Error("Cancel batch was called without batchId"));
            return callback(undefined, undefined);
        }

        if (!batchId && inProgressBatches.size === 1) {
            inProgressBatches.clear();
        }

        if (batchId) {
            if (inProgressBatches.has(batchId)) {
                inProgressBatches.delete(batchId);
                if (inProgressBatches.size) {
                    return callback(Error("Unable to cancel because of another attached batch is in progress."));
                }
            } else {
                return callback(Error("Invalid batchId"));
            }
        }
        let anchorId = dsuAnchorId;
        try {
            $$.debug.logDSUEvent(this, "lockAnchorId in cancelBatch");
            dsuInstancesRegistry.lockAnchorId(anchorId, this);
        } catch (err) {
            return callback(Error("Failed to lock before commit batch"));
        }
        bar.cancelBatch(err => {
            if (err) {
                $$.debug.logDSUEvent(this, "unlockAnchorId in cancelBatch because of error", err);
                dsuInstancesRegistry.unlockAnchorId(anchorId);
                return callback(err);
            }
            dsuInstancesRegistry.notifyBatchCancelled(dsuAnchorId, (...args) => {
                $$.debug.logDSUEvent(this, "unlockAnchorId in cancelBatch");
                dsuInstancesRegistry.unlockAnchorId(anchorId);
                callback(...args);
            });
        });
    }

    this.cancelBatchAsync = async (...args) => {
        return $$.promisify(this.cancelBatch, this)(...args);
    }

    this.setMergeConflictsHandler = (handler) => {
        bar.setMergeConflictsHandler(handler);
    }

    this.commitBatch = (onConflict, batchId, callback) => {
        let args = [];

        if (onConflict) {
            args.push(onConflict);
        }

        if (batchId) {
            args.push(batchId);
        }

        if (callback) {
            args.push(callback);
        }

        switch (args.length) {
            case 3:
                break;
            case 2:
                callback = args[1];
                if (typeof onConflict === "function") {
                    batchId = undefined;
                } else {
                    onConflict = undefined;
                    batchId = args[0];
                }
                break;
            case 1:
                callback = args[0];
                onConflict = undefined;
                batchId = undefined;
                break;
            default:
                throw Error("Wrong api usage");
        }

        if (inProgressBatches.size === 0) {
            return callback(Error("Unable to commit a batch that seems to don't be in batch mode"));
        }

        if (!batchId && inProgressBatches.size > 1) {
            return callback(Error("startOrAttachBatch mode is active but commit batch was called without batchId."));
        }

        if (!batchId && inProgressBatches.size === 1) {
            console.log("Possible dev error: forgot to pass the batchId on the commit method");
            inProgressBatches.clear();
        }

        if (batchId) {
            if (inProgressBatches.has(batchId)) {
                inProgressBatches.delete(batchId);
                if (inProgressBatches.size) {
                    console.debug(`Closing attachedBatch ${batchId}`);
                    $$.debug.logDSUEvent(this, "Closing attachedBatch", batchId);
                    return callback();
                }
            } else {
                $$.debug.logDSUEvent(this, "Invalid batchId", batchId);
                return callback(Error("Invalid batchId"));
            }
        }

        let anchorId = dsuAnchorId;
        try {
            dsuInstancesRegistry.lockAnchorId(anchorId, this);
            $$.debug.logDSUEvent(this, "lockAnchorId in commitBatch", batchId);
        } catch (err) {
            $$.debug.logDSUEvent(this, "\"Failed to lock before commit batch\"", batchId);
            return callback(Error("Failed to lock before commit batch"));
        }

        if (inProgressBatches.size) {
            console.trace("Status of in progress batches", inProgressBatches.size);
        }
        console.debug(`Closing batch ${batchId}`);
        bar.commitBatch(onConflict, err => {
            if (err) {
                return dsuInstancesRegistry.notifyBatchCommitted(dsuAnchorId, (error) => {
                    //we log this second error because we want to exit with the first one...
                    if (error) {
                        console.log("Caught an error when notifying other LegacyDSU instances", error);
                    }
                    dsuInstancesRegistry.unlockAnchorId(anchorId);
                    $$.debug.logDSUEvent(this, "unlockAnchorId in commitBatch because of error in notifying other bars", batchId, err);
                    return callback(err);
                });
            }

            dsuInstancesRegistry.notifyBatchCommitted(dsuAnchorId, (...args) => {
                dsuInstancesRegistry.unlockAnchorId(anchorId);
                $$.debug.logDSUEvent(this, "unlockAnchorId in commitBatch", batchId);
                setTimeout(this.notifyOnCommitBatch, 0);
                callback(...args);
            });
        });
    };

    this.commitBatchAsync = async (...args) => {
        return convertUpdateFnToAsync(this.commitBatch, ...args);
    }

    this.refresh = (callback) => {
        $$.debug.logDSUEvent(this, "Refresh called", `${inProgressBatches.size} batches in progress`);
        if (inProgressBatches.size >= 1) {
            console.warn(Error("DSU is in batch mode. Refresh was not possible"));
            console.log(Array.from(inProgressBatches));
            $$.debug.status();
            return callback(undefined, undefined);
        }

        bar.getKeySSIAsObject((err, keySSI) => {
            if (err) {
                return callback(err);
            }

            const anchoring = require("opendsu").loadApi("anchoring").getAnchoringX();
            return anchoring.getAllVersions(keySSI, (err, versions) => {
                if (err) {
                    return callback(err);
                }
                if (versions.length !== 0) {
                    return dsuInstancesRegistry.loadNewBarInstance(bar, (err, newInstance) => {
                        if (err) {
                            return callback(err);
                        }
                        bar = newInstance;
                        return callback(undefined, bar);
                    });
                }
                callback(undefined, bar);
            });
        });
    };

    this.refreshAsync = async () => {
        return $$.promisify(this.refresh, this)();
    }

    this.getSSIForMount = (mountPoint, callback) => {
        bar.getSSIForMount(mountPoint, callback);
    }

    let listeners = new Set();
    this.onCommitBatch = (notify, once) => {
        if (typeof notify !== "function") {
            throw Error("Not a function");
        }

        if (typeof once === "undefined") {
            once = true;
        }

        listeners.add({notify, once});
    }

    this.notifyOnCommitBatch = () => {
        let numberOfListeners = listeners.size;
        numberOfListeners = numberOfListeners ? "but no" : numberOfListeners

        $$.debug.logDSUEvent(this, "notifyOnCommitBatch   ", numberOfListeners, " listeners");
        let clonedListeners = new Set(listeners);

        clonedListeners.forEach((listener) => {
            let observer = listener;
            if (observer) {
                let {notify, once} = observer;
                if (once) {
                    listeners.delete(listener);
                }
                notify();
            }
        })
    }

    return this;
}

module.exports = LegacyDSU;