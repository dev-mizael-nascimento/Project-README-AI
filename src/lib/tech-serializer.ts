import { type BadgeStyle, findTechIcon } from '@/lib/badges';
import type { Icon, IconProviders } from '@/types/icon';
import type { TechIconItem, TechSectionData } from '@/types/readme';

/** Convert a catalog Icon into a structured TechIconItem. */
export function iconToTechItem(
  icon: Icon,
  preferredProvider: `${IconProviders}` = 'devicons',
): TechIconItem {
  const provider = icon.providers[preferredProvider]
    ? preferredProvider
    : (icon.available_providers[0] as `${IconProviders}`);
  return {
    name: icon.name,
    currentProvider: provider,
    variantIndex: 0,
    providers: icon.providers,
    available_providers: icon.available_providers,
  };
}

/** Resolve the exact image URL for a TechIconItem (respecting provider, variant, and badge style). */
export function resolveTechIconUrl(item: TechIconItem, badgeStyle: BadgeStyle = 'for-the-badge'): string {
  const provider = item.providers[item.currentProvider];
  if (!provider) return '';

  let url = provider.variants?.length
    ? provider.variants[item.variantIndex] || provider.path
    : provider.path;

  if (item.currentProvider === 'shields') {
    url = url.replace(/style=(for-the-badge|flat-square|flat|plastic)/, `style=${badgeStyle}`);
  }
  return url.replace(/ /g, '%20');
}

/** Serialize a structured TechSectionData into GitHub-compatible Markdown/HTML (matching profile-readme-generator). */
export function serializeTechSection(
  data: TechSectionData,
  badgeStyle: BadgeStyle = 'for-the-badge',
): string {
  const imgsHtml = data.icons
    .map((item, idx) => {
      const logo = resolveTechIconUrl(item, badgeStyle);
      const isLast = idx === data.icons.length - 1;
      const img =
        item.currentProvider === 'shields'
          ? `<img src="${logo}" alt="${item.name} logo" />`
          : `<img src="${logo}" height="${data.height}" alt="${item.name} logo" />`;
      const space = data.spacing > 0 && !isLast ? `\n  <img width="${data.spacing}" />` : '';
      return `  ${img}${space}`;
    })
    .join('\n');

  const headingBlock = data.heading.trim() ? `${data.heading.trim()}\n\n` : '';
  return `${headingBlock}<div align="${data.align}">\n${imgsHtml}\n</div>`;
}

/** Build TechIconItem[] from a list of detected tech names using the catalog. */
export function buildTechItemsFromNames(
  names: string[],
  preferredProvider: `${IconProviders}` = 'devicons',
): TechIconItem[] {
  const seen = new Set<string>();
  const items: TechIconItem[] = [];
  for (const name of names) {
    const icon = findTechIcon(name);
    if (!icon || seen.has(icon.name)) continue;
    seen.add(icon.name);
    items.push(iconToTechItem(icon, preferredProvider));
  }
  return items;
}
