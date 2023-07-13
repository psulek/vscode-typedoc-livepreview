# Function: copy()

```ts
copy(
  src, 
  dest, 
  options?): Promise< void >
```

Copy a file or directory. The directory can have contents.

## Parameters


| Parameter | Type | Description |
| :------ | :------ | :------ |
| `src` | `string` | Note that if `src` is a directory it will copy everything inside of this directory, not the entire directory itself (see [issue #537](https://github.com/jprichardson/node-fs-extra/issues/537)). |
| `dest` | `string` | Note that if `src` is a file, `dest` cannot be a directory (see [issue #323](https://github.com/jprichardson/node-fs-extra/issues/323)). |
| `options`? | `CopyOptions` | - |


## Returns

`Promise`\< `void` \>