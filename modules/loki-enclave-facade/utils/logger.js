
function conditionalLog(logger, str) {
    if(process.env.OPENDSU_ENABLE_DEBUG)
        logger.debug(str);
}

module.exports = {
    conditionalLog
}