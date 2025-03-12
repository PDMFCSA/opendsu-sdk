'use strict';

const BrickMapStrategyMixin = require('./BrickMapStrategyMixin');
const Brick = require("../../lib/Brick");

/**
 * @param {object} options
 * @param {function} options.decisionFn Callback which will decide when to effectively anchor changes
 *                                                              If empty, the changes will be anchored after each operation
 * @param {function} options.anchoringCb A callback which is called when the strategy anchors the changes
 * @param {function} options.signingFn  A function which will sign the new alias
 * @param {function} callback
 */
function LatestVersionStrategy(options) {
    options = options || {};
    Object.assign(this, BrickMapStrategyMixin);
    const openDSU = require("opendsu");
    const anchoring = openDSU.loadAPI("anchoring");
    const anchoringx = anchoring.getAnchoringX();
    const bricking = openDSU.loadAPI("bricking");
    ////////////////////////////////////////////////////////////
    // Private methods
    ////////////////////////////////////////////////////////////

    /**
     * @param {Array<string>} hashes
     * @return {string}
     */
    const createBricksCacheKey = (hashes) => {
        return hashes.map(hash => {
            return hash.getIdentifier();
        }).join(':');
    };

    /**
     * @param {Array<Brick>} bricks
     * @return {Array<BrickMapDiff}
     */
    const createMapsFromBricks = (bricks, callback) => {
        const brickMaps = [];
        const __createBrickMapsRecursively = (_bricks) => {
            if (_bricks.length === 0) {
                return setTimeout(() => {
                    callback(undefined, brickMaps);
                });
            }

            const brick = _bricks.shift();
            this.brickMapController.createBrickMap(brick, (err, brickMap) => {
                if (err) {
                    return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to create a new BrickMap`, err));
                }

                brickMaps.push(brickMap);
                __createBrickMapsRecursively(_bricks);
            });
        };

        __createBrickMapsRecursively(bricks);
    }

    /**
     * Get a list of BrickMap objects either from cache
     * or from Brick storage
     *
     * @param {Array<string>} hashes
     * @param {function} callback
     */
    const createBrickMapsFromHistory = (hashes, callback) => {
        callback = $$.makeSaneCallback(callback);
        const cacheKey = createBricksCacheKey(hashes);
        if ($$.BRICK_CACHE_ENABLED) {
            if (this.hasInCache(cacheKey)) {
                const brickMaps = this.getFromCache(cacheKey);
                return setTimeout(() => {
                    callback(undefined, brickMaps);
                });
            }
        }

        const TaskCounter = require("swarmutils").TaskCounter;
        const bricks = [];
        const taskCounter = new TaskCounter(() => {
            createMapsFromBricks(bricks, (err, brickMaps) => {
                if (err) {
                    return callback(createOpenDSUErrorWrapper(`Failed to create maps from bricks`, err));
                }

                this.storeInCache(cacheKey, brickMaps);
                return setTimeout(() => {
                    callback(undefined, brickMaps);
                });
            });
        });
        taskCounter.increment(hashes.length);
        bricking.getMultipleBricks(hashes, (err, brickData) => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to retrieve multiple bricks`, err));
            }

            bricks.push(createBrick(brickData));
            taskCounter.decrement();
        });
    }

    const createBrick = (brickData) => {
        const brick = new Brick();
        brick.setTransformedData(brickData);
        return brick;
    };

    ////////////////////////////////////////////////////////////
    // Public methods
    ////////////////////////////////////////////////////////////

    /**
     * Get the latest BrickMap version after validating the
     * history
     *
     * @param {object} versionHash
     * @param {function} callback
     */
    this.loadBrickMapVersion = (versionHash, callback) => {
        this.currentHashLink = versionHash;
        const brickingAPI = openDSU.loadAPI("bricking");
        brickingAPI.brickExistsOnServer(versionHash, (err, exists) => {
            if (err) {
                return callback(err);
            }

            if (!exists) {
                return callback(new Error(`Brick with hash <${versionHash.getIdentifier()}> does not exist on server`));
            }

            createBrickMapsFromHistory([this.currentHashLink], (err, brickMaps) => {
                if (err) {
                    return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to create BrickMaps from history`, err));
                }

                this.validator.validate('brickMapHistory', brickMaps, (err) => {
                    if (err) {
                        return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to validate BrickMaps`, err));
                    }

                    const latestBrickMap = brickMaps[brickMaps.length - 1];
                    callback(undefined, latestBrickMap);
                });
            })
        })
    }

    this.load = (keySSI, callback) => {
        keySSI.getAnchorId((err, anchorId) => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to get anchorId for keySSI ${keySSI.getIdentifier()}`, err));
            }

            anchoringx.getLastVersion(keySSI, (err, versionHash) => {
                if (err) {
                    return callback(createOpenDSUErrorWrapper(`Failed to get versions for anchor ${anchorId}`, err));
                }
                if (!versionHash) {
                    return callback(new Error(`No data found for anchor <${anchorId}>`));
                }

                const openDSU = require("opendsu");
                const brickingAPI = openDSU.loadAPI("bricking");
                brickingAPI.brickExistsOnServer(versionHash, (err, exists) => {
                    if (err) {
                        return callback(err);
                    }

                    if (!exists) {
                        return callback(new Error(`Brick with hash <${versionHash.getIdentifier()}> does not exist on server`));
                    }

                    const keySSISpace = openDSU.loadAPI("keyssi");
                    if (typeof versionHash === "string") {
                        try {
                            versionHash = keySSISpace.parse(versionHash);
                        } catch (e) {
                            return callback(e);
                        }
                    }
                    this.loadBrickMapVersion(versionHash, callback);
                })
            });
        })
    }

    this.loadVersion = (keySSI, versionHash, callback) => {
        const keySSISpace = require("opendsu").loadAPI("keyssi");
        if (typeof versionHash === "string") {
            try {
                versionHash = keySSISpace.parse(versionHash);
            } catch (e) {
                return callback(e);
            }
        }
        this.loadBrickMapVersion(versionHash, callback);
    };

    /**
     * Compact a list of BrickMapDiff objects
     * into a single BrickMap object
     *
     * @param {BrickMap|undefined} dstBrickMap
     * @return {BrickMapDiff}
     */
    this.compactDiffs = (dstBrickMap, callback) => {
        if (typeof dstBrickMap === 'function') {
            callback = dstBrickMap;
            dstBrickMap = undefined;
        }
        this.brickMapState.prepareNewChangesForAnchoring((err) => {
            if (err) {
                return callback(err);
            }

            const mergeDiffs = (err, dst) => {
                if (err) {
                    return callback(err);
                }

                let result;
                try {
                    result = this.mergeDiffs(dst, this.brickMapState.getDiffsForAnchoring());
                } catch (e) {
                    return callback(e);
                }
                callback(undefined, result);
            }

            if (!dstBrickMap) {
                return this.brickMapState.cloneAnchoredBrickMap(mergeDiffs);
            }

            mergeDiffs(undefined, dstBrickMap);
        })
    }

    /**
     * Tell the BrickMapController to use the newly anchored
     * BrickMap as a valid one
     *
     * @param {BrickMap} diff
     * @param {string} brickMapHashLink
     * @param {function} callback
     */
    this.afterBrickMapAnchoring = (brickMap, brickMapHashLink, callback) => {
        this.currentHashLink = brickMapHashLink;
        this.lastAnchorTimestamp = new Date().getTime();
        this.brickMapState.setAnchoredBrickMap(brickMap);
        this.brickMapState.setCurrentAnchoredHashLink(brickMapHashLink);
        callback(undefined, brickMapHashLink);
    }

    /**
     * Try and fix an anchoring conflict
     *
     * Merge any "pending anchoring" BrickMapDiff objects in a clone
     * of our anchored BrickMap. If merging fails, call the 'conflictResolutionFn'
     * in order to fix the conflict. If merging succeeds, update the "dirtyBrickMap"
     *
     * If no 'conflictResolutionFn' function was defined
     * The callback will be called with the following error:
     *
     *  error: Error {
     *      message: 'Anchoring conflict error',
     *      conflicts: {
     *          files: {
     *              '/file/path/in/conflict': {
     *                  error: 'LOCAL_OVERWRITE|REMOTE_DELETE|LOCAL_DELETE', // type of conflict
     *                  message: '[User friendly error message]'
     *              },
     *              ...
     *          },
     *          theirHashLinkSSI: '...', // HashLinkSSI of the latest anchored BrickMap
     *          ourHashLinkSSI: '...' // The HashLinkSSI of our version
     *      }
     *  }
     *
     *  Where conflicts.*.error:
     *      LOCAL_OVERWRITE - Our changes will overwrite a newly anchored file/directory
     *      REMOTE_DELETE - The file path we're trying to anchor has been deleted
     *      LOCAL_DELETE - Our changes will delete a newly anchored file/directory
     *
     * If a 'conflictResolutionFn' is defined it will be called with the following arguments:
     *  conflicts - The conflicts object described above
     *  callback
     *
     * @param {BrickMap} theirBrickMap The latest anchored BrickMap
     * @param {KeySSI} ourHashLinkSSI
     * @param {function} callback
     */
    this.reconcile = (theirBrickMap, ourHashLinkSSI, callback) => {
        const state = this.brickMapState;

        state.cloneAnchoredBrickMap((err, ourAnchoredBrickMap) => {
            if (err) {
                return callback(err);
            }

            state.prepareNewChangesForAnchoring((err) => {
                if (err) {
                    return callback(err);
                }

                if (this.mergeConflictsHandled(theirBrickMap, ourAnchoredBrickMap, ourHashLinkSSI, callback)) {
                    return;
                }

                // No conflicts detected, merge changes
                let ourChanges;
                let mergedDiffs;
                try {
                    const diffsForAnchoring = state.getDiffsForAnchoring();

                    if (diffsForAnchoring.length) {
                        [ourChanges, mergedDiffs] = this.mergeDiffs(ourAnchoredBrickMap, diffsForAnchoring);
                        theirBrickMap.merge(ourChanges);
                    }

                    // Their BrickMap now has our changes
                    // and becomes ours
                    state.setDirtyBrickMap(theirBrickMap);
                } catch (e) {
                    state.rollback(mergedDiffs)
                    return callback(e);
                }
                return callback(undefined, {
                    status: true,
                    brickMap: theirBrickMap
                });
            });
        })
    };


    this.initialize(options);
}

module.exports = LatestVersionStrategy;
