# Method: log()

```ts
log(
  level, 
  message, 
  error?): void
```

Log message into console logger.

## Parameters


| Parameter | Type | Description |
| :------ | :------ | :------ |
| `level` | `LogLevel` | level of logging message |
| `message` | `string` | content of log message |
| `error`? | `Error` | optional error (in case of logging catched exception) |


## Returns

`void`