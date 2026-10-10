// Deterministic RNG so tests are reproducible.
export function seeded(seed = 42) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}
