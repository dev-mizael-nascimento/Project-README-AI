import type { ReadmeSection } from '@/types/readme';

/**
 * Split any raw Markdown document into editable studio sections by `## ` headings
 * (preserving the top `# ` header/badges as the first section), without requiring AI.
 */
export function splitMarkdownIntoSections(markdown: string): ReadmeSection[] {
  const normalized = markdown.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const lines = normalized.split('\n');
  const sections: ReadmeSection[] = [];
  let currentTitle = 'Header';
  let buffer: string[] = [];
  let inCodeFence = false;

  const flush = () => {
    const content = buffer.join('\n').trim();
    if (!content) return;
    const idBase = currentTitle
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'section';
    sections.push({
      id: `${idBase}-${sections.length + 1}`,
      title: currentTitle,
      markdown: content,
      enabled: true,
    });
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeFence = !inCodeFence;
    }

    if (!inCodeFence && /^##\s+/.test(line)) {
      flush();
      currentTitle = line.replace(/^##\s+/, '').trim();
      buffer = [line];
    } else {
      if (sections.length === 0 && buffer.length === 0 && /^#\s+/.test(line)) {
        currentTitle = line.replace(/^#\s+/, '').replace(/[^\w\sÀ-ÿ-]/g, '').trim() || 'Header';
      }
      buffer.push(line);
    }
  }

  flush();
  return sections;
}
