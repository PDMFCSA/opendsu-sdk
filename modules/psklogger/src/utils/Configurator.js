const config = {
    addressForPublishers: process.env.PSK_PUBLISH_LOGS_ADDR || 'tcp://127.0.0.1:7000',
    addressForSubscribers: process.env.PSK_SUBSCRIBE_FOR_LOGS_ADDR || 'tcp://127.0.0.1:7001',
    addressToCollector: process.env.PSK_COLLECTOR_ADDR || 'tcp://127.0.0.1:5558'
};

module.exports = {
    getConfig() {
        return Object.freeze(config);
    }
};
