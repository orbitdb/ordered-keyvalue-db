import {
  type AccessController,
  Database,
  type Identity,
  type Storage,
} from "@orbitdb/core";
import type { Helia } from "helia";

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
    ipfs: Helia;
    identity?: Identity;
    address: string;
    name?: string;
    access?: AccessController;
    directory?: string;
    meta?: object;
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
      value: unknown,
      position?: number,
    ): Promise<string> => {
      const entryValue: { value: unknown; position?: number } = { value };
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
        hash: string;
      },
      void,
      unknown
    > {
      const keys: { [key: string]: boolean } = {};
      const positions: { [key: string]: number } = {};

      let count = 0;
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
                ? putValue.position
                : 0;
          positions[key] = position;

          count++;
          yield { key, value: putValue.value, position, hash };
        } else if (op === "MOVE" && !keys[key]) {
          positions[key] = value as number;
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
      }[] = [];
      for await (const entry of iterator()) {
        values.unshift(entry);
      }

      return values
        .sort((a, b) =>
          a.position > b.position ? 1 : a.position === b.position ? 0 : -1,
        )
        .map((x) => ({
          key: x.key,
          value: x.value,
          hash: x.hash,
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
