import { useDatabaseType } from "@orbitdb/core";

import OrderedKeyValue from "./ordered-keyvalue.js";

export const registerOrderedKeyValue = () => useDatabaseType(OrderedKeyValue);
