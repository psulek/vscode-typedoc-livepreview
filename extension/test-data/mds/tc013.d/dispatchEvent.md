# Method: dispatchEvent()

```ts
dispatchEvent(event): boolean
```

Dispatches a synthetic event event to target and returns true if either event's cancelable attribute value is false or its preventDefault() method was not invoked, and false otherwise.

## Parameters


| Parameter | Type |
| :------ | :------ |
| `event` | `Event` |


## Returns

`boolean`