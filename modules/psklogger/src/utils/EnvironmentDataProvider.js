function getEnvironmentData() {
    const or = require("overwrite-require");
    let data = {origin: $$.environmentType};

    switch ($$.environmentType) {
        case or.NODEJS_ENVIRONMENT_TYPE:
            const pathModule = "path";
            const path = require(pathModule);
            const osModule = "os";
            const os = require(osModule);
            const platform = os.platform();

            const processPath = process.argv[1];
            const processStartFile = path.basename(processPath);

            data.processStartFile = processStartFile;
            data.platform = platform;
            break;
        case or.BROWSER_ENVIRONMENT_TYPE:
            //todo: maybe we need some details here?
            break;
        default:
            break;
    }
    return data;
}

function getEnvironmentDataForDomain() {
    const osModule = "os";
    const os = require(osModule);
    const platform = os.platform();

    return {
        origin: 'domain',
        domain: process.env.PRIVATESKY_DOMAIN_NAME,
        platform: platform
    };
}

function getEnvironmentDataForAgent() {
    const osModule = "os";
    const os = require(osModule);
    const platform = os.platform();
    const envTypes = require("overwrite-require").constants;

    let data = {origin: "agent"};
    switch ($$.environmentType) {
        case envTypes.THREAD_ENVIRONMENT_TYPE:
            data.domain = process.env.PRIVATESKY_DOMAIN_NAME;
            data.agent = process.env.PRIVATESKY_AGENT_NAME;
            data.platform = platform;
            break;
        default:
            break;
    }
    return data;
}

let handler;

if (process.env.hasOwnProperty('PRIVATESKY_AGENT_NAME')) {
    handler = getEnvironmentDataForAgent;
} else if (process.env.hasOwnProperty('PRIVATESKY_DOMAIN_NAME')) {
    handler = getEnvironmentDataForDomain;
} else {
    handler = getEnvironmentData;
}

if (typeof global.$$.getEnvironmentData === "undefined") {
    global.$$.getEnvironmentData = handler;
} else {
    console.log("EnvironmentData handler already set.");
}

//no need to export anything directly