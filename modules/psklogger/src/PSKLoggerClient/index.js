const Configurator = require('../utils/Configurator');
const GenericPSKLogger = require('./GenericPSKLogger');

function getLogger() {
    let messagePublisher;

    if (process.env.context === 'sandbox') {
        const MessagePublisher = require('../MessagePublisher').MessagePublisherForSandbox;
        messagePublisher = new MessagePublisher();
    } else {
        const config = Configurator.getConfig();
        const MessagePublisher = require('../MessagePublisher').MessagePublisher;
        messagePublisher = new MessagePublisher(config.addressForPublishers);
    }

    return new GenericPSKLogger(messagePublisher);
}

module.exports = {
    getLogger
};
