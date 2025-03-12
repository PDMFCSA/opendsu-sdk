const fs = require('fs');
const path = require('swarmutils').path;
const BRICKSFABRIC_ERROR_CODE = 'bricks fabric error';


function BrickStorage() {
    const logger = $$.getLogger("BrickStorage", "apihub/bricksFabric");

    this.init = function (brickFabricRootFolder, noOfTransactionsPerBlock) {
        this.rootFolder = brickFabricRootFolder;
        this.transactionsPerBlock = noOfTransactionsPerBlock;
        this.hashlinkfile = 'lasthashlink';
        this.lastBlockHashLink = undefined;
        this.pendingTransactions = [];
        this.pendingBuffer = [];
        this.isCommitingBlock = false;
    }

    this.bootUp = function () {
        //get latest hashlink
        const hashlinkpath = path.join(this.rootFolder, this.hashlinkfile);
        if (fs.existsSync(hashlinkpath)) {
            this.lastBlockHashLink = fs.readFileSync(hashlinkpath).toString();
        }
    }

    function __storeLastHashLink() {
        const hashlinkpath = path.join(this.rootFolder, this.hashlinkfile);
        fs.writeFileSync(hashlinkpath, this.lastBlockHashLink);
    }

    this.completeBlock = function (server, callback) {
        if (callback === undefined) {
            callback = () => {
                // Autosave callback.
            };
        }

        if (this.pendingTransactions.length === 0) {
            //No pending transactions
            return;
        }

        //build block
        const blockId = $$.uidGenerator.safe_uuid();
        const block = {
            'blockId': blockId,
            'previousBlockHashLink': this.lastBlockHashLink,
            'transactions': []

        };

        for (let i = 0; i < this.pendingTransactions.length; i++) {
            block.transactions.push(this.pendingTransactions[i])
        }

        __SaveBlockToBrickStorage(JSON.stringify(block), server, callback);
    }

    function __SaveBlockToBrickStorage(data, server, callback) {

        const blockHeaders = {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        };
        const blockPath = "/bricking/default/put-brick";
        const blockMethod = "PUT";
        this.isCommitingBlock = true;

        try {
            server.makeLocalRequest(blockMethod, blockPath, data, blockHeaders, (err, result) => {
                if (err) {
                    logger.error(err);
                    __pushBuffer();
                    this.isCommitingBlock = false;
                    callback(err, undefined);
                }

                if (result) {
                    this.lastBlockHashLink = JSON.parse(result).message;
                    __storeLastHashLink();
                    this.pendingTransactions.splice(0, this.pendingTransactions.length);
                    __pushBuffer();
                    this.isCommitingBlock = false;

                    callback(undefined, result);
                }


            });
        } catch (err) {
            logger.error("bricks fabric", err);
        }
    }

    function __pushBuffer() {
        if (this.pendingBuffer.length > 0) {
            for (let i = 0; i < this.pendingBuffer.length; i++) {
                this.pendingTransactions.push(this.pendingBuffer[i]);
            }
            this.pendingBuffer.splice(0, this.pendingBuffer.length);
        }
    }

    this.storeData = function (anchorData, server, callback) {
        if (this.isCommitingBlock === true) {
            logger.debug("transaction cached");
            this.pendingBuffer.push(anchorData);
            callback(undefined, "Transaction was added to the block.");
            return;
        }
        logger.debug("transaction pushed to pending block");
        this.pendingTransactions.push(anchorData);
        if (this.pendingTransactions.length >= this.transactionsPerBlock) {
            // logger.debug("commit block callback");
            this.completeBlock(server, callback);
        } else {
            //logger.debug("pending callback");
            callback(undefined, "Transaction was added to the block.");
        }
    }
}

global["BrickStorage"] = BrickStorage;
module.exports = {BRICKSFABRIC_ERROR_CODE};