/** Deep-merge plain objects (for locale JSON overlays). Arrays are replaced, not merged. */
export function deepMerge<T extends Record<string, unknown>>(base: T, overlay: Record<string, unknown>): T {
  const out = { ...base } as Record<string, unknown>
  for (const key of Object.keys(overlay)) {
    const b = out[key]
    const o = overlay[key]
    if (
      o !== null &&
      typeof o === 'object' &&
      !Array.isArray(o) &&
      b !== null &&
      typeof b === 'object' &&
      !Array.isArray(b)
    ) {
      out[key] = deepMerge(b as Record<string, unknown>, o as Record<string, unknown>)
    } else {
      out[key] = o
    }
  }
  return out as T
}
