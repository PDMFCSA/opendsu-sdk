# psk-cache

General purpose in-memory caching library used by the PrivateSky components.

## Usage

```javascript
const Cache = require('psk-cache');

// Create a cache instance
const cacheInstance = Cache.factory();

// Cache an item
cacheInstance.set('my-key', 'value');

// Get item from cache
if (cacheInstance.has('my-key')) {
    const value = cacheInstance.get('my-key');
    console.log(value);
}
```

## Cache factory options

```javascript
const cacheInstance = Cache.factory({
    limit: 1000, // Maximum number of items that can be stored in the first storage level
                 // Defaults to 1000
    maxLevels: 3 // Maximum number of storage levels
                 // Defaults to 3
})

```
