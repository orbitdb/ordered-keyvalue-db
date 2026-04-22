import { DagCborEncodable } from "@orbitdb/core";

export type DBElements =
  | number
  | boolean
  | string
  | { [key: string]: DBElements }
  | Array<DBElements>;

export type PutEntryValue = {
  value: DagCborEncodable,
  after?: string,
}