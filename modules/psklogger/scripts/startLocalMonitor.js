const Configurator = require('../src/utils').Configurator;
const MessageSubscriber = require('../src/MessageSubscriber').MessageSubscriber;
const cluster = require('cluster');

/**
 * This script starts two processes.
 *
 * The first one is a Pub/Sub Proxy where all processes connect to configure only the address
 * of this proxy in case multiple subscribers are present, otherwise, each process would know
 * the address of every subscriber
 *
 * The second process is a subscriber of the proxy that redirects all traffic to the "Collector" node
 *
 * @deprecated use the one in opendsu-sdk/scripts/bin
 */

if (cluster.isMaster) {
    // needs to be different process, otherwise it might loose messages if subscribers are slow

    const Configurator = require('../src/utils').Configurator;
    const PubSubProxy = require('../src/PubSubProxy').PubSubProxy;


    const config = Configurator.getConfig();
    new PubSubProxy(config);

    cluster.fork();

} else {
    const NODE_NAME = process.env.NODE_NAME || 'anon';
    const config = Configurator.getConfig();

    const zeroMQModuleName = "zeromq";
    const zmq = require(zeroMQModuleName);
    const sender = zmq.socket('push');
    sender.connect(config.addressForCollector);

    new MessageSubscriber(config.addressForSubscribers, ['logs', ''], (topic, message) => {
        console.log('sending ', {topic: topic.toString(), message: JSON.parse(message.toString())});

        sender.send(JSON.stringify({
            nodeName: NODE_NAME,
            topic: topic.toString(),
            message: JSON.parse(message.toString())
        }));

    });

}


