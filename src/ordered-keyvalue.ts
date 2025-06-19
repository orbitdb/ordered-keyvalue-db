import {
  type AccessController,
  Database,
  type Identity,
  type Storage,
  type MetaData,
  type DagCborEncodable,
  type LogEntry,
  Log,
} from "@orbitdb/core";
import type { HeliaLibp2p } from "helia";
import type { Libp2p } from "libp2p";
import type { ServiceMap } from "@libp2p/interface";

export type OrderedKeyValueDatabaseType = Awaited<
  ReturnType<ReturnType<typeof OrderedKeyValue>>
>;

const type = "ordered-keyvalue" as const;

const OrderedKeyValue =
  () =>
  async <T extends ServiceMap = ServiceMap>({
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
    ipfs: HeliaLibp2p<Libp2p<T>>;
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
    onUpdate?: (log: Log, entry: LogEntry) => void;
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
        hash: string;
      },
      void,
      unknown
    > {
      let count = 0;
      const orderedLogEntries: LogEntry<DagCborEncodable>[] = [];
      for await (const entry of log.traverse()) {
        orderedLogEntries.unshift(entry);
      }

      let finalEntries: {
        key: string;
        value: unknown;
        position: number;
        hash: string;
      }[] = [];
      for (const entry of orderedLogEntries) {
        const { op, key, value } = entry.payload;
        if (!key) return;

        if (op === "PUT") {
          finalEntries = finalEntries.filter((e) => e.key !== key);

          const putValue = value as { value: unknown; position?: number };

          const hash = entry.hash;

          const position =
            putValue.position !== undefined ? putValue.position : -1;
          finalEntries.push({
            key,
            value: putValue.value,
            position,
            hash,
          });
          count++;
        } else if (op === "MOVE") {
          const existingEntry = finalEntries.find((e) => e.key === key);
          if (existingEntry) {
            existingEntry.position = value as number;
            finalEntries = [
              ...finalEntries.filter((e) => e.key !== key),
              existingEntry,
            ];
          }
        } else if (op === "DEL") {
          finalEntries = finalEntries.filter((e) => e.key !== key);
        }
        if (amount !== undefined && count >= amount) {
          break;
        }
      }

      // This is memory inefficient, but I haven't been able to think of a more elegant solution
      for (const entry of finalEntries) {
        yield entry;
      }
    };

    const all = async () => {
      const entries: {
        key: string;
        value: unknown;
        hash: string;
        position: number;
      }[] = [];
      for await (const entry of iterator()) {
        entries.push(entry);
      }

      const values: {
        key: string;
        value: unknown;
        hash: string;
      }[] = [];

      for (const entry of entries) {
        const position =
          entry.position >= 0
            ? entry.position
            : entries.length + entry.position + 1;
        values.splice(position, 0, {
          key: entry.key,
          value: entry.value,
          hash: entry.hash,
        });
      }

      return values;
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
