const SoundPubSub = require("soundpubsub").soundPubSub;
const CHAIN_CHANGED = 'chainChanged';
const WILDCARD = "*";
const CHAIN_SEPARATOR = ".";
const MODEL_PREFIX = "Model";
const ARRAY_CHANGE_METHODS = ['copyWithin', 'fill', 'pop', 'push', 'reverse', 'shift', 'slice', 'sort', 'splice', 'unshift'];
const compactor = function (message, channel) {
    if (message.type === CHAIN_CHANGED) {
        return channel;
    }
};
SoundPubSub.registerCompactor(CHAIN_CHANGED, compactor);

let modelCounter = 0;

class PskBindableModel {

    static setModel(_model) {
        let root = undefined;
        let targetPrefix = MODEL_PREFIX + CHAIN_SEPARATOR + modelCounter + CHAIN_SEPARATOR;
        let observedChains = new Set();
        let referencedChangeCallbacks = [];
        const expressions = {};

        modelCounter++;

        function extendChain(parentChain, currentChain) {
            return parentChain ? parentChain + CHAIN_SEPARATOR + currentChain : currentChain
        }

        function createChannelName(chain) {
            return targetPrefix + chain;
        }

        function makeSetter(parentChain) {
            return function (obj, prop, value) {
                let chain = extendChain(parentChain, prop);
                if (value && typeof value === "object") {
                    obj[prop] = proxify(value, chain);
                } else {
                    obj[prop] = value;
                }
                root.notify(chain);
                return true;
            }
        }

        function pushHandler(target, parentChain) {
            return function (...args) {
                try {
                    let arrayLength = Array.prototype.push.apply(target, args);

                    // we need to proxify the newly added elements
                    for (let index = arrayLength - args.length; index < arrayLength; index++) {
                        target[index] = proxify(target[index], extendChain(parentChain, index.toString()));
                    }

                    let index = arrayLength - 1;
                    root.notify(extendChain(parentChain, index));
                    return arrayLength;
                } catch (e) {
                    console.log("An error occurred in Proxy");
                    throw e;
                }
            }
        }

        function arrayFnHandler(fn, target, parentChain) {
            return function (...args) {
                try {
                    const isArrayChangingMethod = ARRAY_CHANGE_METHODS.indexOf(fn) !== -1;

                    if (isArrayChangingMethod) {
                        // we need to convert each proxified element of the array, since the elements can have their position changed
                        target.forEach((element, index) => {
                            if (typeof target[index] === "object") {
                                target[index] = root.toObject(extendChain(parentChain, index.toString()));
                            }
                        });
                    }

                    let returnedValue = Array.prototype[fn].apply(target, args);

                    if (isArrayChangingMethod) {
                        // we need to proxify all the elements again
                        for (let index = 0; index < target.length; index++) {
                            target[index] = proxify(target[index], extendChain(parentChain, index.toString()));
                        }
                    }

                    if (isArrayChangingMethod) {
                        root.notify(parentChain);
                    }
                    return returnedValue;
                } catch (e) {
                    console.log("An error occurred in Proxy");
                    throw e;
                }
            }
        }


        function proxify(obj, parentChain) {

            if (typeof obj !== "object" || obj instanceof File) {
                return obj;
            }

            let isRoot = !parentChain;
            let notify, onChange, offChange, getChainValue, setChainValue, cleanReferencedChangeCallbacks;
            if (isRoot) {
                notify = function (changedChain) {

                    function getRelatedChains(changedChain) {
                        if (typeof changedChain !== 'string') {
                            changedChain = `${changedChain}`;
                        }
                        let chainsRelatedSet = new Set();
                        chainsRelatedSet.add(WILDCARD);
                        let chainSequence = changedChain.split(CHAIN_SEPARATOR).map(el => el.trim());

                        let chainPrefix = "";
                        for (let i = 0; i < chainSequence.length; i++) {
                            if (i !== 0) {
                                chainPrefix += CHAIN_SEPARATOR + chainSequence[i];
                            } else {
                                chainPrefix = chainSequence[i];
                            }
                            chainsRelatedSet.add(chainPrefix);
                        }

                        observedChains.forEach((chain) => {
                            if (chain.startsWith(changedChain)) {
                                chainsRelatedSet.add(chain);
                            }
                        });

                        return chainsRelatedSet;
                    }

                    let changedChains = getRelatedChains(changedChain);

                    changedChains.forEach(chain => {
                        SoundPubSub.publish(createChannelName(chain), {
                            type: CHAIN_CHANGED,
                            chain: chain,
                            targetChain: changedChain
                        });
                    })
                };

                getChainValue = function (chain) {

                    if (!chain) {
                        return root;
                    }

                    let chainSequence = chain.split(CHAIN_SEPARATOR).map(el => el.trim());
                    let reducer = (accumulator, currentValue) => {
                        if (accumulator !== null && typeof accumulator !== 'undefined') {
                            return accumulator[currentValue];
                        }
                        return undefined;
                    };
                    return chainSequence.reduce(reducer, root);
                };

                setChainValue = function (chain, value) {
                    let chainSequence = chain.split(CHAIN_SEPARATOR).map(el => el.trim());

                    let reducer = (accumulator, currentValue, index, array) => {
                        if (accumulator !== null && typeof accumulator !== 'undefined') {
                            if (index === array.length - 1) {
                                accumulator[currentValue] = value;
                                return true;
                            }
                            accumulator = accumulator[currentValue];
                            return accumulator;
                        }
                        return undefined;
                    };
                    return chainSequence.reduce(reducer, root);
                };

                onChange = function (chain, callback) {
                    observedChains.add(chain);
                    SoundPubSub.subscribe(createChannelName(chain), callback);
                    referencedChangeCallbacks.push({chain: chain, callback: callback});
                }

                offChange = function (chain, callback) {
                    if (observedChains.has(chain)) {
                        let index = referencedChangeCallbacks.findIndex(referenceChangeCallback => {
                            return referenceChangeCallback.callback === callback
                        })
                        if (index !== -1) {
                            referencedChangeCallbacks.splice(index, 1);
                        }
                        SoundPubSub.unsubscribe(createChannelName(chain), callback);
                    }
                }
                cleanReferencedChangeCallbacks = function () {
                    for (let i = 0; i < referencedChangeCallbacks.length; i++) {
                        let {chain, callback} = referencedChangeCallbacks[i];
                        offChange.call(this, chain, callback)
                    }
                }
            }

            function makeArrayGetter(parentChain) {
                const PROXY_ROOT_METHODS = [
                    "toObject",
                    "addExpression",
                    "evaluateExpression",
                    "hasExpression",
                    "onChangeExpressionChain",
                    "offChangeExpressionChain"
                ];
                return function (target, prop) {
                    if (isRoot) {
                        switch (prop) {
                            case "onChange":
                                return onChange;
                            case "offChange":
                                return offChange;
                            case "notify":
                                return notify;
                            case "getChainValue":
                                return getChainValue;
                            case "setChainValue":
                                return setChainValue;
                            case "cleanReferencedChangeCallbacks":
                                return cleanReferencedChangeCallbacks;
                            default:
                                if (PROXY_ROOT_METHODS.includes(prop)) {
                                    return target[prop];
                                }
                        }
                    }

                    if (prop === "__isProxy") {
                        return true;
                    }

                    const val = target[prop];
                    if (typeof val === 'function') {
                        switch (prop) {
                            case "push":
                                return pushHandler(target, parentChain);
                            default:
                                return arrayFnHandler(prop, target, parentChain);
                        }
                    }
                    return val;
                }
            }

            let setter = makeSetter(parentChain);

            let handler = {
                apply: function (target, prop, argumentsList) {
                    throw new Error("A function call was not expected inside proxy!");
                },
                constructor: function (target, args) {
                    throw new Error("A constructor call was not expected inside proxy!");
                },
                isExtensible: function (target) {
                    return Reflect.isExtensible(target);
                },
                preventExtensions: function (target) {
                    return Reflect.preventExtensions(target);
                },
                get: function (obj, prop) {
                    if (isRoot) {
                        switch (prop) {
                            case "onChange":
                                return onChange;
                            case "offChange":
                                return offChange;
                            case "notify":
                                return notify;
                            case "getChainValue":
                                return getChainValue;
                            case "setChainValue":
                                return setChainValue;
                            case "cleanReferencedChangeCallbacks":
                                return cleanReferencedChangeCallbacks;
                        }
                    }

                    if (prop === "__isProxy") {
                        return true;
                    }

                    if (obj instanceof Promise && typeof obj[prop] === "function") {
                        return obj[prop].bind(obj);
                    }

                    return obj[prop];
                },
                set: makeSetter(parentChain),

                deleteProperty: function (oTarget, sKey) {
                    if (sKey in oTarget) {
                        delete oTarget[sKey]
                        return true;
                    }
                    return false
                },

                ownKeys: function (oTarget) {
                    return Reflect.ownKeys(oTarget);
                },
                has: function (oTarget, sKey) {
                    return sKey in oTarget
                },
                defineProperty: function (oTarget, sKey, oDesc) {
                    let oDescClone = Object.assign({}, oDesc);
                    oDescClone.set = function (obj, prop, value) {
                        if (oDesc.hasOwnProperty("set")) {
                            oDesc.set(obj, prop, value);
                        }
                        setter(obj, prop, value);
                    };
                    return Object.defineProperty(oTarget, sKey, oDescClone);
                },
                getOwnPropertyDescriptor: function (oTarget, sKey) {
                    return Object.getOwnPropertyDescriptor(oTarget, sKey)
                },
                getPrototypeOf: function (target) {
                    return Reflect.getPrototypeOf(target)
                },
                setPrototypeOf: function (target, newProto) {
                    Reflect.setPrototypeOf(target, newProto);
                }
            };

            if (Array.isArray(obj)) {
                handler.get = makeArrayGetter(parentChain || "");
            }

            //proxify inner objects
            Object.keys(obj).forEach(prop => {
                if (obj[prop]) {
                    obj[prop] = proxify(obj[prop], extendChain(parentChain, prop));
                }
            });

            if (obj.__isProxy) {
                return obj;
            }

            return new Proxy(obj, handler);
        }

        root = proxify(_model);

        /**
         * This function is returning the object representanion of the proxified model.
         * It accepts only one optional parameter, chain.
         * If no chain is provided, the root model becomes the source.
         *
         * @param {string | null} chain - (Optional) The chain inside the root model.
         * @returns {Object} - The object representanion of the proxified model
         */
        root.toObject = function (chain) {
            let source = {};

            if (!chain) {
                source = root;
            } else if (typeof chain === 'string') {
                source = root.getChainValue(chain);
            }

            if (source && typeof source === 'object') {
                return JSON.parse(JSON.stringify(source));
            }

            return source;
        }

        ////////////////////////////
        // Model expressions support
        ////////////////////////////
        /**
         * @param {string} expressionName
         * @param {callback} callback
         * @param {...string} var_args Variable number of chains to watch. First argument can be an array of chains
         * @throws {Error}
         */
        root.addExpression = function (expressionName, callback, ...args) {
            if (typeof expressionName !== 'string' || !expressionName.length) {
                throw new Error("Expression name must be a valid string");
            }

            if (typeof callback !== 'function') {
                throw new Error("Expression must have a callback");
            }

            let watchChain = [];
            if (args.length) {
                let chainList = args;

                if (Array.isArray(chainList[0])) {
                    chainList = chainList[0];
                }

                watchChain = chainList.filter((chain) => {
                    return typeof chain === 'string' && chain.length;
                });
            }

            expressions[expressionName] = {
                watchChain,
                callback: function () {
                    return callback.call(root);
                }
            }
        }

        /**
         * @param {string} expressionName
         * @return {mixed}
         * @throws {Error}
         */
        root.evaluateExpression = function (expressionName) {
            if (!this.hasExpression(expressionName)) {
                throw new Error(`Expression "${expressionName}" is not defined`);
            }

            return expressions[expressionName].callback();
        }

        /**
         * @param {string} expressionName
         * @return {boolean}
         */
        root.hasExpression = function (expressionName) {
            if (typeof expressions[expressionName] === 'object' &&
                typeof expressions[expressionName].callback === 'function') {
                return true;
            }
            return false;
        }

        /**
         * Watch expression chains
         *
         * @param {string} expressionName
         * @param {callback} callback
         */
        root.onChangeExpressionChain = function (expressionName, callback) {
            if (!this.hasExpression(expressionName)) {
                throw new Error(`Expression "${expressionName}" is not defined`);
            }

            const expr = expressions[expressionName];

            if (!expr.watchChain.length) {
                return;
            }

            for (let i = 0; i < expr.watchChain.length; i++) {
                this.onChange(expr.watchChain[i], callback);
            }
        }
        root.offChangeExpressionChain = function (expressionName, callback) {
            if (!this.hasExpression(expressionName)) {
                return;
            }
            const expr = expressions[expressionName];
            if (!expr.watchChain.length) {
                return;
            }

            for (let i = 0; i < expr.watchChain.length; i++) {
                this.offChange(expr.watchChain[i], callback);
            }
        }

        return root;
    }
}

module.exports = PskBindableModel;
