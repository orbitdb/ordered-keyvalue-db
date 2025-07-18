# @orbitdb/ordered-keyvalue-db
Ordered keyvalue database type for OrbitDB.

[![Tests](https://github.com/orbitdb/ordered-keyvalue-db/actions/workflows/run-test.yml/badge.svg?branch=main)](https://github.com/orbitdb/ordered-keyvalue-db/actions/workflows/tests.yml)
[![codecov](https://codecov.io/gh/orbitdb/ordered-keyvalue-db/graph/badge.svg?token=7OZK4BJDej)](https://codecov.io/gh/orbitdb/ordered-keyvalue-db)

## Installation
```
$ pnpm add @orbitdb/ordered-keyvalue-db
```
## Introduction
A `KeyValue` database where you can move entries around. Ideal for situations where order is important (e.g., lists of tabs in a spreadsheet, etc.). 

## Examples

```ts
import { useDatabaseType, createOrbitDB } from "@orbitdb/core";
import { registerOrderedKeyValue } from "@orbitdb/ordered-keyvalue-db";

// Register database type. IMPORTANT - must call before creating orbit instance !
useDatabaseType(OrderedKeyValue)

const orbit = await createOrbitDB({ ipfs })

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
