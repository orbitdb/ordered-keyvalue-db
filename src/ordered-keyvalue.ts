import {
  type AccessController,
  Database,
  type Identity,
  type Storage,
  type MetaData,
  type DagCborEncodable,
  type LogEntry,
} from "@orbitdb/core";
import type { HeliaLibp2p } from "helia";

export type OrderedKeyValueDatabaseType = Awaited<
  ReturnType<ReturnType<typeof OrderedKeyValue>>
>;

const type = "ordered-keyvalue" as const;

const OrderedKeyValue =
  () =>
  async ({
    ipfs,
    identity,
    address,
    name,
    access,
    directory,
    meta,
    headsStorage,
    entryStorage,
    indexStorage,
    referencesCount,
    syncAutomatically,
    onUpdate,
  }: {
    ipfs: HeliaLibp2p;
    identity?: Identity;
    address: string;
    name?: string;
    access?: AccessController;
    directory?: string;
    meta?: MetaData;
    headsStorage?: Storage;
    entryStorage?: Storage;
    indexStorage?: Storage;
    referencesCount?: number;
    syncAutomatically?: boolean;
    onUpdate?: () => void;
  }) => {
    const database = await Database({
      ipfs,
      identity,
      address,
      name,
      access,
      directory,
      meta,
      headsStorage,
      entryStorage,
      indexStorage,
      referencesCount,
      syncAutomatically,
      onUpdate,
    });

    const { addOperation, log } = database;

    const put = async (
      key: string,
      value: DagCborEncodable,
      position?: number,
    ): Promise<string> => {
      const entryValue: { value: DagCborEncodable; position?: number } = {
        value,
      };
      if (position !== undefined) {
        entryValue.position = position;
      }
      return addOperation({ op: "PUT", key, value: entryValue });
    };

    const move = async (key: string, position: number): Promise<string> => {
      return addOperation({ op: "MOVE", key, value: position });
    };

    const del = async (key: string): Promise<string> => {
      return addOperation({ op: "DEL", key, value: null });
    };

    const get = async (
      key: string,
    ): Promise<{ value: unknown; position?: number } | undefined> => {
      for await (const entry of log.traverse()) {
        const { op, key: k, value } = entry.payload;
        if (op === "PUT" && k === key) {
          return value as { value: unknown; position?: number };
        } else if (op === "DEL" && k === key) {
          return undefined;
        }
      }
      return undefined;
    };

    const iterator = async function* ({
      amount,
    }: { amount?: number } = {}): AsyncGenerator<
      {
        key: string;
        value: unknown;
        position: number;
        clock: number;
        hash: string;
      },
      void,
      unknown
    > {
      const keys: { [key: string]: boolean } = {};
      const positions: { [key: string]: {position: number; clock: number } } = {};

      let count = 0;
      let clock = 0;
      for await (const entry of log.traverse()) {
        const { op, key, value } = entry.payload;
        if (!key) return;

        if (op === "PUT" && !keys[key]) {
          keys[key] = true;
          const putValue = value as { value: unknown; position?: number };

          const hash = entry.hash;

          const position =
            positions[key] !== undefined
              ? positions[key]
              : putValue.position !== undefined
                ? {position: putValue.position, clock}
                : {position: -1, clock};
          positions[key] = position;

          count++;
          clock--;
          yield { key, value: putValue.value, ...position, hash };
        } else if (op === "MOVE" && !keys[key] && !positions[key]) {  // À faire ici
          positions[key] = {position: value as number, clock};
          clock--;
        } else if (op === "DEL" && !keys[key]) {
          keys[key] = true;
        }
        if (amount !== undefined && count >= amount) {
          break;
        }
      }
    };

    const all = async () => {
      const values: {
        key: string;
        value: unknown;
        hash: string;
        position: number;
        clock: number;
      }[] = [];
      for await (const entry of iterator()) {
        values.unshift(entry);
      }
      const nonNegativePositionValues = values.map(
        v => ({
          ...v,
          position: v.position >= 0 ? v.position : values.length + (v.position)
        })
      )
      console.log(nonNegativePositionValues)

      return nonNegativePositionValues
        .sort((a, b) =>{
          return a.position > b.position ? 1 : a.position === b.position ? (
            a.clock - b.clock
          ) : -1
        }
        )
        .map((v) => ({
          key: v.key,
          value: v.value,
          hash: v.hash,
        }));
    };

    return {
      ...database,
      type,
      put,
      set: put, // Alias for put()
      del,
      move,
      get,
      iterator,
      all,
    };
  };

OrderedKeyValue.type = type;

export default OrderedKeyValue;
