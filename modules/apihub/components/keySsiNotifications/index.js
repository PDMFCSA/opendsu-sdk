function KeySSINotifications(server) {
    const logger = $$.getLogger("KeySSINotifications", "apihub/keySsiNotifications");
    let notificationManager;
    const utils = require('../../http-wrapper/utils');
    const readBody = utils.streams.readStringFromStream;
    const config = require('../../http-wrapper/config');
    const {responseModifierMiddleware} = require('../../http-wrapper/utils/middlewares');
    const {URL_PREFIX} = require('./constants');
    const path = require("path");
    const workingDirPath = path.join(server.rootFolder, config.getConfig('componentsConfig', 'notifications', 'workingDirPath'));
    const QUEUED_MESSAGE_LIFETIME = 500; // (ms) Delete undelivered messages after this timeout

    function publish(request, response) {
        let anchorId = request.params.anchorId;

        readBody(request, (err, message) => {
            if (err) {
                return response.send(400);
            }

            notificationManager.createQueue(anchorId, function (err) {
                if (err) {
                    if (err.statusCode) {
                        if (err.statusCode !== 409) {
                            response.statusCode = err.statusCode;
                            return response.end();
                        }
                    } else {
                        return response.send(500);
                    }
                }

                notificationManager.sendMessage(anchorId, message, QUEUED_MESSAGE_LIFETIME, function (err, counter) {
                    if (err) {
                        return response.send(500);
                    }

                    let message;

                    if (counter > 0) {
                        message = `Message delivered to ${counter} subscribers.`;
                    } else {
                        message = `Message was added to queue and will be delivered later.`;
                    }

                    return response.send(200, message);
                });
            });
        });
    }

    function subscribe(request, response) {
        let anchorId = request.params.anchorId;

        notificationManager.createQueue(anchorId, function (err) {
            if (err) {
                if (err.statusCode) {
                    if (err.statusCode !== 409) {
                        response.statusCode = err.statusCode;
                        return response.end();
                    }
                } else {
                    return response.send(500);
                }
            }

            notificationManager.readMessage(anchorId, function (err, message) {
                try {
                    if (err) {
                        response.statusCode = err.statusCode || 500;
                        response.end(message);
                        return;
                    }

                    response.send(200, message);
                } catch (err) {
                    //here we expect to get errors when a connection has reached timeout
                    logger.error(err);
                    response.send(400, 'ups. something went wrong.');
                }
            });
        });
    }

    function unsubscribe(request, response) {
        //to be implemented later
        response.send(503);
    }

    require('../../http-wrapper/src/Notifications').getManagerInstance(workingDirPath, (err, instance) => {
        if (err) {
            return logger.error(err);
        }

        notificationManager = instance;
        server.use(`${URL_PREFIX}/*`, responseModifierMiddleware)

        server.post(`${URL_PREFIX}/subscribe/:anchorId`, subscribe);
        server.delete(`${URL_PREFIX}/unsubscribe/:anchorId`, unsubscribe);
        server.put(`${URL_PREFIX}/publish/:anchorId`, publish);
    });
}

module.exports = KeySSINotifications;
