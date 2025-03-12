const openDSU = require("opendsu");

class FS {
    constructor(server, domainConfig, anchorId, anchorValue, jsonData) {
        this.commandData = {};
        this.commandData.option = domainConfig.option;
        this.commandData.anchorId = anchorId;
        this.commandData.anchorValue = anchorValue;
        this.commandData.jsonData = jsonData || {};
        const FilePersistence = require('./filePersistence').FilePersistenceStrategy;
        this.fps = new FilePersistence(server.rootFolder, domainConfig.option.path, domainConfig.name);
        this.anchoringBehaviour = openDSU.loadApi("anchoring").getAnchoringBehaviour(this.fps);
    }

    createAnchor(callback) {
        this.anchoringBehaviour.createAnchor(this.commandData.anchorId, this.commandData.anchorValue, callback);
    }

    appendAnchor(callback) {
        this.anchoringBehaviour.appendAnchor(this.commandData.anchorId, this.commandData.anchorValue, callback);
    }

    totalNumberOfAnchors(callback) {
        this.fps.totalNumberOfAnchors(callback);
    }

    getAllVersions(callback) {
        this.anchoringBehaviour.getAllVersions(this.commandData.anchorId, (err, anchorValues) => {
            if (err) {
                return callback(err);
            }
            if (anchorValues.length === 0) {
                return callback(undefined, anchorValues);
            }

            callback(undefined, anchorValues.map(el => el.getIdentifier()));
        });
    }

    getLastVersion(callback) {
        this.anchoringBehaviour.getLastVersion(this.commandData.anchorId, (err, anchorValue) => {
            if (err) {
                return callback(err);
            }

            if (anchorValue) {
                return callback(undefined, anchorValue.getIdentifier());
            }

            callback();
        });
    }
}

module.exports = FS;
