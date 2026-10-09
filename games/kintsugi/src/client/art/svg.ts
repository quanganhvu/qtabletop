/** SVG forbids repeated attributes, but drawings often override a shared style
 * string (e.g. a different stroke-width); keep the last value of each. */
function dedupeAttributes(svg: string): string {
  return svg.replace(/<[a-zA-Z][^>]*>/g, (tag) => {
    const seen = new Map<string, string>();
    const head = tag.match(/^<[a-zA-Z]+/)![0];
    for (const [, name, value] of tag.matchAll(/\s([\w:-]+)="([^"]*)"/g)) {
      seen.delete(name);
      seen.set(name, value);
    }
    const attrs = [...seen].map(([n, v]) => ` ${n}="${v}"`).join('');
    return `${head}${attrs}${tag.endsWith('/>') ? '/>' : '>'}`;
  });
}

/** A CSS `url(...)` holding the given SVG markup as an image. */
export function svgUrl(svg: string): string {
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(dedupeAttributes(svg))}")`;
}
