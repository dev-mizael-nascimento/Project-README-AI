import { tech_icons } from '@/resources/tech_icons';
import type { Icon, IconProviders } from '@/types/icon';

export type BadgeStyle = 'for-the-badge' | 'flat' | 'flat-square' | 'plastic';

const norm = (s: string) => s.toLowerCase().replace(/[-_.\s]/g, '');

/** Find a tech icon in the full catalog by name, shortname, or alias. */
export function findTechIcon(query: string): Icon | undefined {
  const n = norm(query);
  return (tech_icons as Icon[]).find(
    (item) =>
      norm(item.name) === n ||
      (item.shortname && norm(item.shortname) === n) ||
      item.alias.some((a) => norm(a) === n),
  );
}

/** Search tech icons in the catalog by query (name, alias, or tags). */
export function searchTechIcons(query: string, limit = 36): Icon[] {
  const q = query.trim().toLowerCase();
  const list = tech_icons as Icon[];
  if (!q) return list.slice(0, limit);

  return list
    .filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.shortname?.toLowerCase().includes(q) ||
        item.alias.some((a) => a.toLowerCase().includes(q)) ||
        item.tags.some((t) => t.toLowerCase().includes(q)),
    )
    .slice(0, limit);
}

/** Render a single tech icon as HTML <img> (matching profile-readme-generator) or Markdown badge. */
export function renderTechIconSnippet(
  icon: Icon,
  provider: `${IconProviders}` = 'shields',
  options?: { style?: BadgeStyle; height?: number },
): string {
  const chosenProvider = icon.providers[provider]
    ? provider
    : (icon.available_providers[0] as `${IconProviders}`);
  const entry = icon.providers[chosenProvider];
  if (!entry) return '';

  let url = entry.path;
  if (chosenProvider === 'shields' && options?.style) {
    url = url.replace(/style=(for-the-badge|flat-square|flat|plastic)/, `style=${options.style}`);
  }
  url = url.replace(/ /g, '%20');

  if (chosenProvider === 'shields') {
    return `![${icon.name}](${url})`;
  }

  const height = options?.height ?? 40;
  return `<img src="${url}" height="${height}" alt="${icon.name} logo" />`;
}

/** Build Shields.io badge markdown for detected technologies using the full catalog. */
export function buildTechBadgesMarkdown(
  techs: string[],
  style: BadgeStyle = 'for-the-badge',
): string {
  const seen = new Set<string>();
  const badges: string[] = [];

  for (const raw of techs) {
    const key = norm(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const icon = findTechIcon(raw);
    if (icon?.providers.shields?.path) {
      const url = icon.providers.shields.path
        .replace(/style=(for-the-badge|flat-square|flat|plastic)/, `style=${style}`)
        .replace(/ /g, '%20');
      badges.push(`![${raw}](${url})`);
    } else if (icon) {
      const first = icon.providers[icon.available_providers[0]];
      if (first?.path) {
        badges.push(`<img src="${first.path}" height="32" alt="${raw} logo" />`);
      }
    } else {
      const safeLabel = encodeURIComponent(raw.replace(/-/g, ' '));
      badges.push(`![${raw}](https://img.shields.io/badge/${safeLabel}-27272A?style=${style})`);
    }
  }

  return badges.join(' ');
}

/** Update Shields.io badge style across an existing markdown snippet. */
export function applyBadgeStyleToMarkdown(markdown: string, style: BadgeStyle): string {
  return markdown.replace(
    /(https:\/\/img\.shields\.io\/badge\/[^)\s]+style=)(for-the-badge|flat-square|flat|plastic)/g,
    `$1${style}`,
  );
}
