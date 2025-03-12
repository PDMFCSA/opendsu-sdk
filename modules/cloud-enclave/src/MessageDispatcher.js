function MessageDispatcher(didDoc) {
    this.waitForMessages = (callback) => {
        didDoc.subscribe((err, res) => {
            if (err) {
                callback(err);
                return
            }

            callback(undefined, JSON.parse(res));
        });
    };

    this.sendMessage = (result, clientDID) => {
        const opendsu = require("opendsu");
        opendsu.loadApi("w3cdid").resolveDID(clientDID, (err, clientDIDDocument) => {
            if (err) {
                return console.log(err);
            }
            console.log("Preparing to send message to" + clientDID);
            didDoc.sendMessage(result, clientDIDDocument, (err) => {
                console.log(`Message sent to ${clientDID} client`)
                if (err) {
                    console.log(err);
                }
            })
        });
    };
}

module.exports = {
    MessageDispatcher
}