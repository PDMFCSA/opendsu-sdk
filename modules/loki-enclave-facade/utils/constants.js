const DBKeys = {
    PK: "_id",
    TIMESTAMP: "timestamp",
    REV: "_rev",
    LOKI_ID: "$loki", // LokiDB unique ID
    META: "meta" // LokiDB property
};

const ReadUser = "reader"

const SortOrder = {
    ASC: "asc",
    DESC: "desc",

    /**
     * @deprecated Use `SortOrder.DSC` instead.
     * Kept for LokiDB compatibility. Will be removed in a future release.
     */
    DSC: "dsc"
};

const OpenDSUKeys = {
    PK: "pk",
    TIMESTAMP: "__timestamp",
    FALLBACK_INSERT: "__fallbackToInsert",
};

const Permissions = {
    WRITE_ACCESS: "write",
    READ_ACCESS: "read",
    WILDCARD: "*"
};

const Tables = {
    READ_WRITE_KEY: "KeyValueTable",
    KEY_SSIS_TABLE:"keyssis",
    SEED_SSIS_TABLE : "seedssis",
    DIDS_PRIVATE_KEYS : "dids_private"
};

const DBOperatorsMap = {
    "!=": "$ne",
    "==": "$eq",
    ">": "$gt",
    ">=": "$gte",
    "<": "$lt",
    "<=": "$lte",
    "like": "$regex",
    "||": "$or"
};

const DSUKeysToDBMapping = {
    [OpenDSUKeys.PK]: DBKeys.PK,
    [OpenDSUKeys.TIMESTAMP]: DBKeys.TIMESTAMP
};

const DBKeysToDSUMapping = Object.fromEntries(
    Object.entries(DSUKeysToDBMapping).map(([key, value]) => [value, key])
);

module.exports = {
    DBOperatorsMap,
    DBKeys,
    OpenDSUKeys,
    Permissions,
    Tables,
    SortOrder,
    DSUKeysToDBMapping,
    DBKeysToDSUMapping,
    ReadUser
};