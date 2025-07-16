export const sortPosition = <T>(array: (T & { position: number })[]): T[] => {
  const sorted = array.toSorted((a, b) => a.position - b.position);
  return sorted.map((x) => {
    delete (x as T & { position?: number })["position"];
    return x;
  });
};
