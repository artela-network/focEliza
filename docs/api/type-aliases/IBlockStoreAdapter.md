[@ai16z/eliza v0.1.4-alpha.3](../index.md) / IBlockStoreAdapter

# Type Alias: IBlockStoreAdapter

> **IBlockStoreAdapter**: `object`

Interface for block store

## Type declaration

### pull()

> **pull**: \<`T`\>(`idx`) => `Promise`\<`T`\>

Fetches the value associated with the specified key from the store.

#### Type Parameters

• **T**

#### Parameters

• **idx**: `string`

The unique identifier for the value to retrieve.

#### Returns

`Promise`\<`T`\>

A promise that resolves with the retrieved value.

### push()

> **push**: \<`T`\>(`value`) => `Promise`\<`string`\>

Stores a value in the store with an automatically generated key.

#### Type Parameters

• **T**

#### Parameters

• **value**: `T`

The value to store.

#### Returns

`Promise`\<`string`\>

A promise that resolves with the generated key for the stored value.

## Defined in

[packages/core/src/types.ts:738](https://github.com/artela-network/focEliza/blob/main/packages/core/src/types.ts#L738)
