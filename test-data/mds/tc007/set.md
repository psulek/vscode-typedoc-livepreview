# Method: set()

```ts
set(
  key, 
  value, 
  expireTimeout?): default< K, V >
```



## Parameters


| Parameter | Type | Description |
| :------ | :------ | :------ |
| `key` | `K` | key to set new item in map. |
| `value` | `V` | value to set new item in map. |
| `expireTimeout`? | `number` | expiration timeout (in ms) after which item from map will be removed on retrieval. |


## Returns

`default`\< `K`, `V` \>

ExpireMap same instance.