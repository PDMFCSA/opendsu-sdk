const constants = require("../moduleConstants");

function ObservableMixin(target) {
    let observers = {};

    target.on = function (eventType, callback) {
        let arr = observers[eventType];
        if (!arr) {
            arr = observers[eventType] = [];
        }
        arr.push(callback);
    }

    target.off = function (eventType, callback) {
        let arr = observers[eventType];
        if (!arr) {
            //nothing to do...
            reportDevRelevantInfo("Off-ing an unknown observer");
            return;
        }
        let index = observers[eventType].indexOf(callback);
        if (index === -1) {
            reportDevRelevantInfo("Observer not found into the list of known observers.");
            return;
        }

        observers[eventType].splice(index, 1);
    }

    target.dispatchEvent = function (eventType, message) {
        let arr = observers[eventType];
        if (!arr) {
            //no handlers registered
            if (eventType !== constants.NOTIFICATION_TYPES.DEV) {
                reportDevRelevantInfo(`No observers found for event type ${eventType}`);
            } else {
                console.debug(`No observers found for event type ${eventType}`);
            }

            return;
        }

        arr.forEach(c => {
            try {
                c(message);
            } catch (err) {
                console.error(err);
                reportDevRelevantInfo(`Caught an error during the delivery of ${eventType} to ${c.toString()}`);
            }

        });
    }

    target.removeAllObservers = function (eventType) {
        if (observers[eventType]) {
            delete observers[eventType];
        } else {
            reportDevRelevantInfo("No observers found in the list of known observers.");
        }
    }
}

module.exports = ObservableMixin;
