export const getScalePosition = ({
  entries,
  key,
  position,
}: {
  entries: {
    key: string;
    position: number;
  }[];
  key: string;
  position: number;
}): number => {
  // Firstly, sort entries by position
  entries = entries.sort((a, b) => a.position - b.position);

  // Negative values mean insert from end of list.
  if (position < 0) position = entries.length - (position + 1);

  // Find any previous position
  const previousPosition = entries.findIndex((x) => x.key === key);

  // If we are moving upwards, need to add 1 to adjust for the now-deleted slot where our entry used to be
  if (previousPosition !== -1 && position > previousPosition)
    position = position + 1;

  // Calculate scale positions of previous and next entries, if they exist
  const previousScalePosition =
    entries[Math.min(position, entries.length) - 1]?.position;
  const nextScalePosition = entries[Math.max(position, 0)]?.position;

  // Insert to beginning of list if there is no preceding entry
  // Note: use Math.random() rather to reduce risk of collisions in concurrent edits
  if (previousScalePosition === undefined)
    return nextScalePosition === undefined
      ? Math.random()
      : nextScalePosition - Math.random();

  // Insert to end of list if there is no following entry, or somewhere between adjacent entries
  return nextScalePosition === undefined
    ? previousScalePosition + Math.random()
    : previousScalePosition +
        (nextScalePosition - previousScalePosition) * Math.random();
};
