import {
  type AccessController,
  Database,
  type Identity,
  type Storage,
  type MetaData,
  type DagCborEncodable,
  type LogEntry,
  Log,
  InternalDatabase,
} from "@orbitdb/core";
import type { HeliaLibp2p } from "helia";
import type { Libp2p } from "libp2p";
import type { ServiceMap } from "@libp2p/interface";
import itAll from "it-all";
import { getScalePosition } from "./utils.js";

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

    const { put, set, del, move, get, iterator, all } = OrderedKeyValueApi({
      database,
    });

    return {
      ...database,
      type,
      put,
      set,
      del,
      move,
      get,
      iterator,
      all,
    };
  };

OrderedKeyValue.type = type;

export const OrderedKeyValueApi = ({
  database,
}: {
  database: InternalDatabase;
}) => {
  const put = async (
    key: string,
    value: DagCborEncodable,
    position?: number,
  ): Promise<string> => {
    // Somewhat inefficient, I suppose, but we need to know which entries are already present.
    const entries = await itAll(iterator());

    // Avoid overwriting existing position; default to end of list (findIndex gives -1)
    let scaledPosition: number | undefined = undefined;
    if (position === undefined) {
      scaledPosition = entries.find((e) => e.key === key)?.position;
    }
    if (scaledPosition === undefined) {
      scaledPosition = await getScalePosition({
        entries,
        key,
        position: position ?? -1,
      });
    }

    const entryValue = {
      value,
      position: scaledPosition,
    };

    return database.addOperation({ op: "PUT", key, value: entryValue });
  };

  const move = async (key: string, position: number): Promise<void> => {
    // Somewhat inefficient, I suppose, but we need to know which entries are already present.
    const entries = await itAll(iterator());
    position = await getScalePosition({ entries, key, position });

    await database.addOperation({ op: "MOVE", key, value: position });
  };

  const del = async (key: string): Promise<string> => {
    return database.addOperation({ op: "DEL", key, value: null });
  };

  const get = async (key: string): Promise<DagCborEncodable | undefined> => {
    for await (const entry of database.log.traverse()) {
      const { op, key: k, value } = entry.payload;
      if (op === "PUT" && k === key) {
        return (value as { value: DagCborEncodable; position: number }).value;
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

    // `true` indicates a `PUT` operation; `number` indicates a `MOVE` operation
    const keys: { [key: string]: true | number } = {};

    for await (const entry of database.log.traverse()) {
      const { op, key, value } = entry.payload;
      if (typeof key !== "string") continue;

      if (op === "PUT" && keys[key] !== true) {
        const hash = entry.hash;
        const putValue = value as { value: unknown; position: number };

        const position =
          typeof keys[key] === "number"
            ? (keys[key] as number)
            : putValue.position;
        keys[key] = true;
        count++;

        yield {
          key,
          value: putValue.value,
          position,
          hash,
        };
      } else if (op === "MOVE" && !keys[key]) {
        keys[key] = value as number;
      } else if (op === "DEL") {
        keys[key] = true;
      }
      if (amount !== undefined && count >= amount) {
        break;
      }
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
    return entries
      .sort((a, b) => a.position - b.position)
      .map((e) => ({
        key: e.key,
        value: e.value,
        hash: e.hash,
      }));
  };

  return {
    get,
    set: put, // Alias for put()
    put,
    move,
    del,
    iterator,
    all,
  };
};

export default OrderedKeyValue;
