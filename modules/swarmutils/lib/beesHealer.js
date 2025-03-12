const OwM = require("./OwM");

/*
    Prepare the state of a swarm to be serialised
*/

exports.asJSON = function (valueObj, phaseName, args, callback) {

    let valueObject = valueObj.valueOf();
    let res = new OwM();
    res.publicVars = valueObject.publicVars;
    res.privateVars = valueObject.privateVars;

    res.setMeta("COMMAND_ARGS", OwM.prototype.getMetaFrom(valueObject, "COMMAND_ARGS"));
    res.setMeta("SecurityParadigm", OwM.prototype.getMetaFrom(valueObject, "SecurityParadigm"));
    res.setMeta("swarmTypeName", OwM.prototype.getMetaFrom(valueObject, "swarmTypeName"));
    res.setMeta("swarmId", OwM.prototype.getMetaFrom(valueObject, "swarmId"));
    res.setMeta("target", OwM.prototype.getMetaFrom(valueObject, "target"));
    res.setMeta("homeSecurityContext", OwM.prototype.getMetaFrom(valueObject, "homeSecurityContext"));
    res.setMeta("requestId", OwM.prototype.getMetaFrom(valueObject, "requestId"));


    if (!phaseName) {
        res.setMeta("command", "stored");
    } else {
        res.setMeta("phaseName", phaseName);
        res.setMeta("phaseId", $$.uidGenerator.safe_uuid());
        res.setMeta("args", args);
        res.setMeta("command", OwM.prototype.getMetaFrom(valueObject, "command") || "executeSwarmPhase");
    }

    res.setMeta("waitStack", valueObject.meta.waitStack); //TODO: think if is not better to be deep cloned and not referenced!!!

    if (callback) {
        return callback(null, res);
    }
    //console.log("asJSON:", res, valueObject);
    return res;
};

exports.jsonToNative = function (serialisedValues, result) {

    for (let v in serialisedValues.publicVars) {
        result.publicVars[v] = serialisedValues.publicVars[v];

    }
    for (let l in serialisedValues.privateVars) {
        result.privateVars[l] = serialisedValues.privateVars[l];
    }

    for (let i in OwM.prototype.getMetaFrom(serialisedValues)) {
        OwM.prototype.setMetaFor(result, i, OwM.prototype.getMetaFrom(serialisedValues, i));
    }

};