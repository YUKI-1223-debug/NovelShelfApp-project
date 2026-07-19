const PALETTE: [string, string][] = [
  ["#3b4f78", "#232f47"],
  ["#7a5a45", "#4a3626"],
  ["#5c7a5f", "#33472f"],
  ["#7a4560", "#472536"],
  ["#8a7a3f", "#4f4520"],
  ["#476a7a", "#243b47"],
];

export function coverGradient(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
