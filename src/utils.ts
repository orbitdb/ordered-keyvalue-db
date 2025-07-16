export const getScalePosition = async ({
  entries,
  key,
  position,
}: {
  entries: {
    key: string;
    value: unknown;
    position: number;
    hash: string;
  }[];
  key: string;
  position: number;
}): Promise<number> => {
  // Firstly, sort entries by position
  entries = entries.sort((a, b) => a.position - b.position);

  // Negative values mean insert from end of list.
  if (position < 0) position = entries.length - (position + 1);

  // Find any previous position
  const previousPosition = entries.find((x) => x.key === key)?.position;

  // If we are moving upwards, need to add 1 to adjust for the now-deleted slot where our entry used to be
  if (previousPosition !== undefined && position > previousPosition)
    position = position + 1;

  // Calculate scale positions of previous and next entries, if they exist
  const beforePosition =
    entries[Math.min(position, entries.length) - 1]?.position;
  const afterPosition = entries[Math.max(position, 0)]?.position;

  // Insert to beginning of list if there is no preceding entry
  // Note: use Math.random() rather than mean to reduce risk of collisions in concurrent edits
  if (beforePosition === undefined)
    return afterPosition === undefined
      ? Math.random()
      : afterPosition - Math.random();

  // Insert to end of list if there is no following entry, or somewhere between adjacent entries
  return afterPosition === undefined
    ? beforePosition + 1 * Math.random()
    : beforePosition + (afterPosition - beforePosition) * Math.random();
};
