# Kuiper
Additional database types for orbit-db.

[![Orbit-db Kuiper tests](https://github.com/reseau-constellation/orbit-db-kuiper/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/reseau-constellation/orbit-db-kuiper/actions/workflows/tests.yml)
[![codecov](https://codecov.io/gh/reseau-constellation/orbit-db-kuiper/graph/badge.svg?token=7OZK4BJDej)](https://codecov.io/gh/reseau-constellation/orbit-db-kuiper)

## Installation
```
$ pnpm add @constl/orbit-db-kuiper
```
## Introduction
`Kuiper` brings additional database types to `orbit-db`.

* `Feed`: For those feeling nostalgic for orbit-db v.0.x. But honestly, you're probably better off with a `KeyValue` or a `Set`.
* `Set`: Like `Feed`, but each value can only be present once. Works for primitive types as well as more complex objects.
* `OrderedKeyValue`: A `KeyValue` database where you can move entries around. Ideal for situations where order is important (e.g., lists of tabs in a spreadsheet, etc.). 

## Examples

### Set
As simple example with `Set`:
```ts
import { createOrbit } from "@orbitdb/core";
import { registerAll } from "@constl/orbit-db-kuiper";

// Register Kuiper database types. IMPORTANT - must call before creating orbit instance !
registerAll();

const orbit = await createOrbit({ ipfs })

const db = await orbit.open({ type: "set" });

await db.add(1);
await db.add(2);

const all = await db.all();  // [1, 2]

await db.add(1);
await db.all()  // Yay !! Still [1, 2]
```

### Feed
```ts
const db = await orbit.open({ type: "feed" });

await db.add({ a: 1, b: "c" });

const all = await db.all();  // [{ value: { a: 1, b: "c" }, hash: "..." }]

await db.add({ a: 1, b: "c" });
await db.all();  
// [{ value: { a: 1, b: "c" }, hash: "..." }, { value: { a: 1, b: "c" }, hash: "..." }]
```

### OrderedKeyValue

```ts

const db = await orbit.open({ type: "ordered-keyvalue" });

await db.put("a", "some value");
await db.put("b", "another value");

const all = await db.all();
// [{ key: "a", value: "some value", hash: "..." }, { key: "b", value: "another value", hash: "..." }]

await db.move("a", 1)

await db.all();
// [{ key: "b", value: "another value", hash: "..." }, { key: "a", value: "some value", hash: "..." }]

// You can also specify the position on `put`
await db.put("c", "goes first", 0);

await db.all();
// [{ key: "c", value: "goes first", hash: "..." }, { key: "b", value: "another value", hash: "..." }, { key: "a", value: "some value", hash: "..." }]

```
