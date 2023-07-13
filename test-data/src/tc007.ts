// testcase: class|5-10
// testcase: ctor|11-15
// testcase: set|17-26

/**
 * Expiration map like class.
 * @typeParam K - key type in map.
 * @typeParam V - value type in map.
 */
export default class ExpireMap<K, V> {
    /**
     * Creates new instance of {@link ExpireMap} class.
     */
    constructor() {
    }

    /**
     * 
     * @param key - key to set new item in map.
     * @param value - value to set new item in map.
     * @param expireTimeout - expiration timeout (in ms) after which item from map will be removed on retrieval.
     * @returns {@link ExpireMap} same instance.
     */
    public set(key: K, value: V, expireTimeout?: number): this {
        return this;
    }
}