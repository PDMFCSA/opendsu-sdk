
function conditionalLog(logger, str) {
    if(process.env.OPENDSU_ENABLE_DEBUG)
        logger.info(str);
}

module.exports = {
    conditionalLog
}