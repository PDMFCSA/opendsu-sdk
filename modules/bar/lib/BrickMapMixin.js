'use strict';

const Brick = require("./Brick");
const pskPath = require("swarmutils").path;
const pathModule = "path";
let path;
try {
    path = require(pathModule);
} catch (err) {
} finally {
    if (typeof path === "undefined") {
        path = {sep: "/"};
    }
}

const BrickMapMixin = {
    header: null,
    templateKeySSI: null,

    /**
     * @param {Brick|string|object} header
     */
    initialize: function (header, options) {
        options = options || {};
        this.header = header;
        if (this.header) {
            if (typeof this.header === "object" && !this.header.embedded) {
                //for backwards compatibility reasons
                this.header.embedded = {};
            }
            return;
        }

        this.header = {
            v: 1,
            items: {},
            metadata: {},
            embedded: {}
        }

        if (!options.disableTimeMetadata) {
            this.header.metadata.createdAt = this.getTimestamp();
        }
    },

    updateTimeMetadata: function (target, prop, timestamp) {
        if (typeof target === "string") {
            target = this.getDeepestNode(target);
        }

        if (!target) {
            return;
        }

        prop = prop || "updatedAt";
        timestamp = timestamp || this.getTimestamp();
        if (this.header.metadata.createdAt) {
            if (!target.metadata) {
                target.metadata = {};
            }
            target.metadata[prop] = timestamp;
        }
    },

    /**
     * @return {boolean}
     */
    hasItems: function () {
        return Object.keys(this.header.items).length > 0 || (this.header.embedded && Object.keys(this.header.embedded).length > 0);
    },

    /**
     * @return {string}
     */
    getTimestamp: function () {
        return new Date().toUTCString();
    },

    /**
     * @param {object} node
     * @param {object} brick
     */
    appendBrick: function (node, brick) {
        this.updateTimeMetadata(node);
        const index = node.hashLinks.findIndex(br => br.hashLink === brick.hashLink);
        if (index !== -1) {
            throw Error(`Trying to add the same brick`);
        }

        node.hashLinks.push(brick);
    },

    /**
     * @param {string} filePath
     */
    getNodeFromPath: function (filePath) {
        filePath = pskPath.normalize(filePath);
        if (filePath === "") {
            throw new Error(`File path must not be empty.`);
        }

        const filePathNode = this.createNodesFromPath(filePath);
        // If this node was previously deleted, remove the "deletedAt" timestamp
        if (filePathNode.metadata.deletedAt) {
            delete filePathNode.metadata.deletedAt;
        }

        return filePathNode;
    },

    /**
     * @param {string} filePath
     * @param {object} brick
     */
    replaceFirstBrick: function (filePath, brick) {
        const node = this.getNodeFromPath(filePath);
        this.updateTimeMetadata(node);
        if (node.hashLinks.length > 0) {
            node.hashLinks[0] = brick;
        }
    },

    /**
     * @param {string} filePath
     * @param {object} brick
     */
    replaceLastBrick: function (filePath, brick) {
        const node = this.getNodeFromPath(filePath);
        this.updateTimeMetadata(node);
        if (node.hashLinks.length > 0) {
            node.hashLinks[node.hashLinks.length - 1] = brick;
        }
    },

    /**
     * @param {object} parent
     * @param {string} name
     */
    createFileNode: function (parent, name) {
        const node = {
            hashLinks: [],
            metadata: {}
        };
        parent.items[name] = node;
        this.updateTimeMetadata(node, "createdAt");
    },

    /**
     * @param {object} root
     * @param {string} name
     */
    createDirectoryNode: function (root, name) {
        const node = {
            metadata: {},
            items: {}
        }
        root.items[name] = node;
        this.updateTimeMetadata(node, "createdAt");
    },

    /**
     * Create all the nodes required to traverse `path`
     * and return the deepest node in the tree
     *
     * @param {string} path
     * @param {object} options
     * @param {string} options.trailingNodeType Possible values are 'child' or 'parent'
     * @return {object}
     */
    createNodesFromPath: function (path, options) {
        options = options || {
            trailingNodeType: 'child',
            addCreatedAtTimestamp: true
        };

        const pathSegments = path.split('/');

        let parentNode = this.header;
        let nodeName;

        while (pathSegments.length) {
            nodeName = pathSegments.shift();
            if (nodeName === "") {
                nodeName = pathSegments.shift();
            }

            if (parentNode.items[nodeName]) {
                delete parentNode.items[nodeName].metadata.deletedAt;
            }

            if (typeof parentNode.metadata === 'object') {
                // remove the "deletedAt" attribute in case we're trying
                // to add an entry in a previously deleted folder
                delete parentNode.metadata.deletedAt;
            }

            if (!pathSegments.length) {
                break;
            }


            if (!parentNode.items[nodeName]) {
                this.createDirectoryNode(parentNode, nodeName);
            }
            parentNode = parentNode.items[nodeName];
        }

        if (!parentNode.items[nodeName]) {
            if (options.trailingNodeType === 'child') {
                this.createFileNode(parentNode, nodeName);
            } else {
                this.createDirectoryNode(parentNode, nodeName);
            }
        }

        return parentNode.items[nodeName];
    },

    /**
     * @param {string} nodePath
     * @return {string} Returns a parent directory's path
     */
    dirname: function (path) {
        const segments = path.split('/');
        if (segments.length === 2 && segments[0] === "") {
            return '/';
        }
        return segments.slice(0, -1).join('/');
    },

    /**
     * @param {string} nodePath
     * @return {string} Returns trailing name component of a path
     */
    basename: function (path) {
        const segments = path.split('/');
        return segments.pop();
    },

    /**
     * @param {object} node
     * @return {boolean}
     */
    nodeIsDeleted: function (node) {
        return typeof node.metadata.deletedAt !== 'undefined';
    },

    /**
     * @param {object} node
     * @return {boolean}
     */
    nodeIsDirectory: function (node) {
        return typeof node.items === 'object';
    },

    /**
     * @param {object} node
     */
    deleteNode: function (node) {
        this.updateTimeMetadata(node, "deletedAt");
        if (this.nodeIsDirectory(node)) {
            node.items = {};
            return;
        }

        node.hashLinks = [];
    },

    /**
     * @param {object} node
     */
    truncateNode: function (node) {
        delete node.metadata.deletedAt;
        this.updateTimeMetadata(node);
        if (this.nodeIsDirectory(node)) {
            node.items = {};
        }

        node.hashLinks = [];
    },

    /**
     * Traverse the nodes identified by `toPath`
     * and return the deepest parent node in the tree
     *
     * @param {string} toPath
     * @return {object|undefined}
     */
    navigate: function (toPath) {
        let parentNode = this.header;
        const segments = toPath.split("/");

        for (let i in segments) {
            let segment = segments[i];
            if (!segment) {
                continue;
            }


            if (typeof parentNode.items[segment] === 'undefined') {
                return;
            }

            if (this.nodeIsDirectory(parentNode.items[segment])) {
                parentNode = parentNode.items[segment];

            }
        }

        return parentNode;
    },

    /**
     * Traverse `path` and return the deepest node
     * in the tree
     *
     * @param {string} path
     * @return {object}
     */
    getDeepestNode: function (path) {
        path = pskPath.normalize(path);
        if (path === '/') {
            return this.header;
        }

        const filename = this.basename(path);
        const dirPath = this.dirname(path);

        const parentNode = this.navigate(dirPath);

        if (!parentNode) {
            return;
        }

        return parentNode.items[filename];
    },


    /**
     * @param {string} path
     * @param {Array<object>} bricks
     */
    addFileEntry: function (path, bricks) {
        if (!this.isEmpty(path)) {
            this.emptyList(path);
        }

        this.appendBricksToFile(path, bricks);
    },

    /**
     * @param {string} path
     * @param {Array<object>} bricks
     */
    appendBricksToFile: function (path, bricks) {
        if (!Array.isArray(bricks)) {
            bricks = [bricks];
        }
        for (const data of bricks) {
            this.add(path, data);
        }
    },

    /**
     * Add brick data for `filePath`
     *
     * @param {string} filePath
     * @param {object} brick
     * @param {string} brick.hash
     * @param {object} brick.encryptionKey
     * @param {string} brick.checkSum
     *
     * @throws {Error}
     */
    add: function (filePath, brick) {
        filePath = pskPath.normalize(filePath);
        if (filePath === "") {
            throw new Error(`File path must not be empty.`);
        }

        const brickObj = {
            checkSum: brick.checkSum,
            hashLink: brick.hashLink
        };
        if (brick.size) {
            brickObj.size = brick.size;
        }

        if (brick.encryptionKey) {
            brickObj.key = brick.encryptionKey
        }

        const filePathNode = this.createNodesFromPath(filePath);
        // If this node was previously deleted, remove the "deletedAt" timestamp
        if (filePathNode.metadata.deletedAt) {
            delete filePathNode.metadata.deletedAt;
        }
        this.appendBrick(filePathNode, brickObj);
    },

    /**
     * @param {string} barPath
     * @throws {Error}
     */
    delete: function (barPath) {
        barPath = pskPath.normalize(barPath);
        const childNode = this.getDeepestNode(barPath);
        if (!childNode) {
            return;
        }
        if (this.nodeIsDeleted(childNode)) {
            return;
        }

        this.deleteNode(childNode);

        let deleteEmbedded = () => {
            if (this.header && this.header.embedded) {
                let embeddedFiles = Object.keys(this.header.embedded);
                for (let filepath of embeddedFiles) {
                    if (filepath.startsWith(barPath)) {
                        delete this.header.embedded[filepath];
                    }
                }
            }
        }

        deleteEmbedded();
    },

    createNode: function (barPath, options) {
        barPath = pskPath.normalize(barPath);

        if (barPath === '/') {
            throw new Error('Invalid path: /');
        }

        const dirName = this.basename(barPath);
        const dirPath = this.dirname(barPath);
        const parentDir = this.getDeepestNode(dirPath);

        if (!dirName) {
            throw new Error('Missing folder name.');
        }

        if (dirPath && parentDir) {
            if (!this.nodeIsDirectory(parentDir)) {
                throw new Error('Unable to create a folder in a file.');
            }

            if (typeof parentDir.items[dirName] !== 'undefined' && options.trailingNodeType === "parent") {
                const currentNode = parentDir.items[dirName];
                if (this.nodeIsDeleted(currentNode)) {
                    // trying to create an already deleted node
                    // so we need remove the "deletedAt" timestamp
                    delete currentNode.metadata.deletedAt;
                    this.updateTimeMetadata(currentNode, "createdAt");
                    return;
                }

                throw new Error('Unable to create folder. A file or folder already exists in that location.');
            }
        }

        this.createNodesFromPath(barPath, options);
    },
    /**
     * Create an empty directory
     *
     * @param {string} barPath
     * @throws {Error}
     */
    createFolder: function (barPath) {
        this.createNode(barPath, {trailingNodeType: "parent"});
    },

    createFile: function (barPath) {
        this.createNode(barPath, {trailingNodeType: "child"});
    },
    /**
     * @param {string} filePath
     * @return {Array<object>}
     * @throws {Error}
     */
    getBricksMeta: function (filePath) {
        const fileNode = this.getDeepestNode(filePath);
        if (!fileNode) {
            throw new Error(`Path <${filePath}> not found.`);
        }
        if (this.nodeIsDirectory(fileNode)) {
            throw new Error(`Path <${filePath}> is a folder.`);
        }

        if (this.nodeIsDeleted(fileNode)) {
            throw new Error(`Path <${filePath}> not found.`);
        }

        return fileNode.hashLinks;
    },

    /**
     * @param {string} filePath
     * @return {Array<string>}
     * @throws {Error}
     */
    getHashList: function (filePath) {
        if (filePath === "") {
            throw new Error(`File path must not be empty.`);
        }

        const fileNode = this.getDeepestNode(filePath);
        if (!fileNode) {
            throw new Error(`Path <${filePath}> not found.`);
        }
        if (this.nodeIsDirectory(fileNode)) {
            throw new Error(`Path <${filePath}> is a folder.`);
        }

        const hashes = fileNode.hashLinks.map(brickObj => brickObj.hashLink);
        return hashes;
    },

    getEmbeddedFile: function (filePath) {
        if (filePath === "") {
            throw Error(`File path must not be empty.`);
        }

        let data;
        if (this.header.embedded && this.header.embedded[filePath]) {
            data = this.header.embedded[filePath].content;
        }

        return data;
    },

    putEmbeddedFile: function (filePath, data) {
        if (filePath === "") {
            throw Error(`File path must not be empty.`);
        }

        if (!this.header.embedded) {
            this.header.embedded = {};
        }

        let embeddedFile = this.header.embedded[filePath];
        if (!embeddedFile) {
            embeddedFile = {
                content: data,
                metadata: {}
            };
            this.header.embedded[filePath] = embeddedFile;
            this.updateTimeMetadata(embeddedFile, 'createdAt');
            return;
        }

        embeddedFile.content = data;
        this.updateTimeMetadata(embeddedFile);
    },

    appendToEmbedded: function (filePath, data) {
        let existingData = this.getEmbeddedFile(filePath);
        if (!existingData) {
            existingData = "";
        }

        this.putEmbeddedFile(filePath, existingData + data);
    },
    /**
     * @param {string} filePath
     * @return {boolean}
     */
    isEmpty: function (filePath) {
        const node = this.getDeepestNode(filePath);
        if (!node) {
            return true;
        }

        if (this.nodeIsDirectory(node)) {
            return !Object.keys(node.items);
        }
        return !node.hashLinks.length;
    },

    /**
     * Truncates `filePath`
     * @param {string} filePath
     * @throws {Error}
     */
    emptyList: function (filePath) {
        const node = this.getDeepestNode(filePath);
        if (!node) {
            throw new Error(`Path <${filePath}> not found.`);
        }

        this.truncateNode(node);
    },

    /**
     * @param {string} path
     * @return {boolean}
     */
    fileExists: function (path) {
        const node = this.getDeepestNode(path);
        return node && !this.nodeIsDeleted(node);
    },

    /**
     * @param {string} path
     * @return {boolean}
     */
    fileDeleted: function (path) {
        const node = this.getDeepestNode(path);
        return node && this.nodeIsDeleted(node);
    },

    /**
     * @param {string} srcPath
     * @param {string} dstPath
     * @throws {Error}
     */
    copy: function (srcPath, dstPath) {
        const srcNode = this.getDeepestNode(srcPath);
        if (!srcNode) {
            throw new Error(`Source path <${srcPath}> not found.`);
        }

        const dstNode = this.createNodesFromPath(dstPath, {
            trailingNodeType: this.nodeIsDirectory(srcNode) ? 'parent' : 'child',
            addCreatedAtTimestamp: true
        });

        if (this.nodeIsDirectory(srcNode)) {
            // Clone hashlinks
            dstNode.items = JSON.parse(JSON.stringify(srcNode.items));
            return;
        }

        dstNode.hashLinks = JSON.parse(JSON.stringify(srcNode.hashLinks));
    },


    /**
     * @return {Brick}
     */
    toBrick: function () {
        let brickOptions = {templateKeySSI: this.templateKeySSI, brickMap: true};
        let hint = this.templateKeySSI.getHint();
        if (hint && hint.get("avoidRandom")) {
            brickOptions.avoidRandom = true;
        }
        const brick = new Brick(brickOptions);
        brick.setKeySSI(this.templateKeySSI);
        brick.setRawData($$.Buffer.from(JSON.stringify(this.header)));
        return brick;
    },


    /**
     * @param {string} folderBarPath
     * @param {boolean} recursive
     * @return {Array<string>}
     */
    getFileList: function (folderBarPath, recursive) {
        let listEmbeddedFiles = () => {
            let files = [];
            if (this.header.embedded) {
                if (recursive) {
                    let embeddedFiles = Object.keys(this.header.embedded);
                    for (let filePath of embeddedFiles) {
                        if (filePath.startsWith(folderBarPath)) {
                            files.push(filePath.replace(folderBarPath, ""));
                        }
                    }
                } else {
                    let embeddedFiles = Object.keys(this.header.embedded);
                    for (let filePath of embeddedFiles) {
                        if (filePath.startsWith(folderBarPath)) {
                            let relativePath = filePath.replace(folderBarPath, "");
                            if (relativePath.indexOf("/") === -1) {
                                files.push(relativePath);
                            } else {
                                //we skip this file because seems to be a directory (contains at least one more / character)
                            }
                        }
                    }
                }
            }
            return files;
        }

        if (typeof recursive === "undefined") {
            recursive = true;
        }
        const node = this.getDeepestNode(folderBarPath);
        if (!node) {
            let embeddedFiles = listEmbeddedFiles();
            return embeddedFiles;
        }

        const findFiles = (nodes, currentPath) => {
            let files = [];
            currentPath = currentPath || '';

            for (const itemName in nodes) {
                const item = nodes[itemName];
                const itemPath = pskPath.join(currentPath, itemName);

                if (this.nodeIsDirectory(item) && recursive) {
                    files = files.concat(findFiles(item.items, itemPath));
                    continue;
                }

                if (!this.nodeIsDeleted(item) && !this.nodeIsDirectory(item)) {
                    files.push(itemPath);
                }

            }

            return files;
        }

        const files = findFiles(node.items);
        const embeddedFiles = listEmbeddedFiles();

        return files.concat(embeddedFiles);
    },

    /**
     * @param {string} barPath
     * @param {boolean} recursive
     * @return {Array<string>}
     */
    getFolderList: function (barPath, recursive) {
        const node = this.getDeepestNode(barPath);
        if (!node) {
            return [];
        }

        const findFolders = (nodes, currentPath) => {
            let folders = [];
            currentPath = currentPath || '';

            for (const itemName in nodes) {
                const item = nodes[itemName];
                const itemPath = pskPath.join(currentPath, itemName);

                if (!this.nodeIsDirectory(item) || this.nodeIsDeleted(item)) {
                    continue;
                }

                folders.push(itemPath);

                if (recursive) {
                    folders = folders.concat(findFolders(item.items, itemPath));

                }
            }

            return folders;
        }

        const folders = findFolders(node.items);
        return folders;
    },

    getBrickEncryptionKeySSI: function (brickMeta) {
        if (typeof brickMeta === "undefined") {
            return this.templateKeySSI.getIdentifier();
        }

        return brickMeta.key;
    },

    /**
     * Load BrickMap state
     */
    load: function (callback) {
        /**
         * JSON reviver callback
         * Convert serialized $$.Buffer to $$.Buffer instance
         * @param {string} key
         * @param {string} value
         * @return {*}
         */
        const reviver = (key, value) => {
            if (key !== 'key') {
                return value;
            }

            if (typeof value !== 'object') {
                return value;
            }

            if (Object.keys(value).length !== 2) {
                return value;
            }

            if (value.type !== '$$.Buffer' || !Array.isArray(value.data)) {
                return value;
            }
            return $$.Buffer.from(value.data);
        };

        if (this.header instanceof Brick) {
            this.header.setKeySSI(this.templateKeySSI);
            this.header.setKeySSI(this.templateKeySSI.getIdentifier());
            this.header.getRawData((err, rawData) => {
                if (err) {
                    return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to get raw data`, err));
                }

                this.header = JSON.parse(rawData.toString(), reviver);
                setTimeout(() => {
                    callback();
                });
            });
        } else {
            if ($$.Buffer.isBuffer(this.header)) {
                this.header = this.header.toString();
            }

            if (typeof this.header === "string") {
                this.header = JSON.parse(this.header, reviver);
            }
            setTimeout(() => {
                callback();
            });
        }
    },

    /**
     * @param {KeySSI} keySSI
     */
    setKeySSI: function (keySSI) {
        this.templateKeySSI = keySSI;
    },

    /**
     * @return {KeySSI}
     */
    getTemplateKeySSI: function () {
        return this.templateKeySSI;
    },

    /**
     * @return {BrickMap}
     */
    clone: function (options, callback) {
        if (typeof options === "function") {
            callback = options;
            options = {};
        }
        const InstanceClass = this.constructor;
        const brickMap = new InstanceClass(JSON.stringify(this.header), options);
        brickMap.setKeySSI(this.templateKeySSI);
        brickMap.load((err) => {
            if (err) {
                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to load brickMap`, err));
            }

            callback(undefined, brickMap);
        });
    },

    /**
     * @return {object}
     */
    getState: function () {
        return JSON.parse(JSON.stringify(this.header));
    },

    /**
     * @param {string} path
     * @return {object}
     * @throws {Error}
     */
    getMetadata: function (path) {
        const node = this.getDeepestNode(path);
        if (!node) {
            throw new Error(`Path <${path}> not found.`);
        }

        if (typeof node.metadata === 'undefined') {
            throw new Error(`Path dosn't have any metadata associated.`);
        }

        return node.metadata
    },

    /**
     * @param {object} metadata
     * @throws {Error}
     */
    setMetadata: function (path, metadata) {
        const node = this.getDeepestNode(path);
        if (!node) {
            throw new Error(`Path <${path}> not found.`);
        }
        node.metadata = JSON.parse(JSON.stringify(metadata));
    },

    /**
     * @param {string} path
     * @param {string} key
     * @param {*} value
     * @throws {Error}
     */
    updateMetadata: function (path, key, value) {
        const node = this.getDeepestNode(path);
        if (!node) {
            throw new Error(`Unable to update metadata. Path <${path}> not found.`);
        }

        node.metadata[key] = value;
    },

    getHashLink: function (callback) {
        const brick = this.toBrick();
        brick.setKeySSI(this.getBrickEncryptionKeySSI());
        brick.getHashLink(callback);
    },

    stat: function (path) {
        const node = this.getDeepestNode(path);
        if (this.nodeIsDirectory(node)) {
            return {type: "directory"}
        } else {
            return {type: "file"}
        }
    }
}

module.exports = BrickMapMixin;
