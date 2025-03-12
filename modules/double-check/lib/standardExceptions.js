exports.init = function (sf) {
    /**
     * Registering unknown exception handler.
     */
    sf.exceptions.register('unknown', function (explanation) {
        explanation = explanation || "";
        const message = "Unknown exception" + explanation;
        throw (message);
    });

    /**
     * Registering resend exception handler.
     */
    sf.exceptions.register('resend', function (exceptions) {
        throw (exceptions);
    });

    /**
     * Registering notImplemented exception handler.
     */
    sf.exceptions.register('notImplemented', function (explanation) {
        explanation = explanation || "";
        const message = "notImplemented exception" + explanation;
        throw (message);
    });

    /**
     * Registering security exception handler.
     */
    sf.exceptions.register('security', function (explanation) {
        explanation = explanation || "";
        const message = "security exception" + explanation;
        throw (message);
    });

    /**
     * Registering duplicateDependency exception handler.
     */
    sf.exceptions.register('duplicateDependency', function (variable) {
        variable = variable || "";
        const message = "duplicateDependency exception" + variable;
        throw (message);
    });
};