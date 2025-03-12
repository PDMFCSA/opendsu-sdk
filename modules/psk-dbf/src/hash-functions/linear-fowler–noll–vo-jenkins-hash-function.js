const fowlerNollVo1a = require("./fowler–noll–vo-1a");
const jenkins = require("./jenkins");

function linearFowlerNollVoJenkinsHashFunction(data, index, options) {
    const {bitCount} = options;
    return (fowlerNollVo1a(data) + index * jenkins(data)) % bitCount;
}

module.exports = linearFowlerNollVoJenkinsHashFunction;
