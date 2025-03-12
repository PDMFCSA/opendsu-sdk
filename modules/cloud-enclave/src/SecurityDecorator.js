function SecurityDecorator(enclave) {
    const accessControlModes = require("./constants").ACCESS_CONTROL_MODES;
    const persistence = require("acl-magic").createEnclavePersistence(enclave, undefined, "cloud-enclave");

    this.grantReadAccess = (forDID, resource, callback) => {
        persistence.loadZoneParents(forDID, (err, parents) => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to load zone parents for ${forDID}`, err));
            }

            if (parents.indexOf(accessControlModes.READ) !== -1) {
                return persistence.grant(accessControlModes.READ, forDID, resource, callback);
            }

            persistence.addZoneParent(forDID, accessControlModes.READ, err => {
                if (err) {
                    return callback(createOpenDSUErrorWrapper(`Failed to grant read access to ${forDID} for resource ${resource}`, err));
                }

                persistence.grant(accessControlModes.READ, forDID, resource, callback);
            });
        });
    }

    this.hasReadAccess = (forDID, resource, callback) => {
        persistence.loadResourceDirectGrants(accessControlModes.READ, resource, (err, grants) => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to load direct grants for resource ${resource}`, err));
            }

            if (grants.indexOf(forDID) !== -1) {
                return callback(undefined, true);
            }

            callback(undefined, false);
        });
    }

    this.revokeReadAccess = (forDID, resource, callback) => {
        persistence.delZoneParent(forDID, accessControlModes.READ, err => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to revoke read access to ${forDID} for resource ${resource}`, err));
            }

            persistence.ungrant(accessControlModes.READ, forDID, resource, callback);
        });
    }

    this.grantWriteAccess = (forDID, resource, callback) => {
        this.grantReadAccess(forDID, resource, err => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to grant read access to ${forDID} for resource ${resource}`, err));
            }

            persistence.loadZoneParents(forDID, (err, parents) => {
                if (err) {
                    return callback(createOpenDSUErrorWrapper(`Failed to load zone parents for ${forDID}`, err));
                }

                if (parents.indexOf(accessControlModes.WRITE) !== -1) {
                    return persistence.grant(accessControlModes.WRITE, forDID, resource, callback);
                }

                persistence.addZoneParent(forDID, accessControlModes.WRITE, err => {
                    if (err) {
                        return callback(createOpenDSUErrorWrapper(`Failed to grant write access to ${forDID} for resource ${resource}`, err));
                    }

                    persistence.grant(accessControlModes.WRITE, forDID, resource, callback);
                });
            });
        })
    }

    this.hasWriteAccess = (forDID, resource, callback) => {
        persistence.loadResourceDirectGrants(accessControlModes.WRITE, resource, (err, grants) => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to load direct grants for resource ${resource}`, err));
            }

            if (grants.indexOf(forDID) !== -1) {
                return callback(undefined, true);
            }

            callback(undefined, false);
        });
    }

    this.grantAdminAccess = (forDID, resource, callback) => {
        persistence.addZoneParent(forDID, accessControlModes.ADMIN, err => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to grant admin access to ${forDID} for resource ${resource}`, err));
            }

            persistence.grant(accessControlModes.ADMIN, forDID, resource, callback);
        });
    }

    this.hasAdminAccess = (forDID, resource, callback) => {
        persistence.loadResourceDirectGrants(accessControlModes.ADMIN, resource, (err, grants) => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to load direct grants for resource ${resource}`, err));
            }

            if (grants.indexOf(forDID) !== -1) {
                return callback(undefined, true);
            }

            callback(undefined, false);
        });
    }

    this.revokeAdminAccess = (forDID, resource, callback) => {
        persistence.delZoneParent(forDID, accessControlModes.ADMIN, err => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to revoke admin access to ${forDID} for resource ${resource}`, err));
            }

            persistence.ungrant(accessControlModes.ADMIN, forDID, resource, callback);
        });
    }

    this.callLambda = (forDID, lambdaName, ...args) => {
        const callback = args[args.length - 1];
        this.hasAdminAccess(forDID, lambdaName, (err, hasAccess) => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to check if ${forDID} has admin access to ${lambdaName}`, err));
            }

            if (!hasAccess) {
                return callback(createOpenDSUErrorWrapper(`Admin access denied for ${forDID} to ${lambdaName}`));
            }

            enclave.callLambda(forDID, lambdaName, ...args);
        })
    }

    this.insertRecord = (forDID, tableName, pk, record, callback) => {
        this.hasWriteAccess(forDID, tableName, (err, hasAccess) => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to check if ${forDID} has write access to ${tableName}`, err));
            }

            if (!hasAccess) {
                return callback(createOpenDSUErrorWrapper(`Write access denied for ${forDID} to ${tableName}`));
            }

            enclave.insertRecord(forDID, tableName, pk, record, callback);
        })
    }

    this.updateRecord = (forDID, tableName, pk, record, callback) => {
        this.hasWriteAccess(forDID, tableName, (err, hasAccess) => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to check if ${forDID} has write access to ${tableName}`, err));
            }

            if (!hasAccess) {
                return callback(createOpenDSUErrorWrapper(`Write access denied for ${forDID} to ${tableName}`));
            }

            enclave.updateRecord(forDID, tableName, pk, record, callback);
        })
    }

    this.deleteRecord = (forDID, tableName, pk, callback) => {
        this.hasWriteAccess(forDID, tableName, (err, hasAccess) => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to check if ${forDID} has write access to ${tableName}`, err));
            }

            if (!hasAccess) {
                return callback(createOpenDSUErrorWrapper(`Write access denied for ${forDID} to ${tableName}`));
            }

            enclave.deleteRecord(forDID, tableName, pk, callback);
        })
    }

    this.getRecord = (forDID, tableName, key, callback) => {
        this.hasReadAccess(forDID, tableName, (err, hasAccess) => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to check if ${forDID} has read access to ${tableName}`, err));
            }

            if (!hasAccess) {
                return callback(createOpenDSUErrorWrapper(`Read access denied for ${forDID} to ${tableName}`));
            }

            enclave.getRecord(forDID, tableName, key, callback);
        })
    }

    this.getAllRecords = (forDID, tableName, callback) => {
        this.hasReadAccess(forDID, tableName, (err, hasAccess) => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to check if ${forDID} has read access to ${tableName}`, err));
            }

            if (!hasAccess) {
                return callback(createOpenDSUErrorWrapper(`Read access denied for ${forDID} to ${tableName}`));
            }

            enclave.getAllRecords(forDID, tableName, callback);
        })
    }

    this.filter = (forDID, tableName, filterConditions, sort, max, callback) => {
        this.hasReadAccess(forDID, tableName, (err, hasAccess) => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to check if ${forDID} has read access to ${tableName}`, err));
            }

            if (!hasAccess) {
                return callback(createOpenDSUErrorWrapper(`Read access denied for ${forDID} to ${tableName}`));
            }

            enclave.filter(forDID, tableName, filterConditions, sort, max, callback);
        })
    }
}

module.exports = SecurityDecorator;