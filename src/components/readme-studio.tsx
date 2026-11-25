'use client';

import {
  Activity,
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Check,
  Code2,
  Copy,
  CopyPlus,
  Cpu,
  Download,
  Eye,
  FileText,
  GitBranch,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Minus,
  Pencil,
  Plug,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Type,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { GridPulseBg } from '@/components/grid-pulse-bg';
import {
  type BadgeStyle,
  applyBadgeStyleToMarkdown,
  searchTechIcons,
} from '@/lib/badges';
import { STUDIO_BLOCK_PRESETS } from '@/lib/studio-blocks';
import {
  iconToTechItem,
  resolveTechIconUrl,
  serializeTechSection,
} from '@/lib/tech-serializer';
import type { Icon, IconProviders } from '@/types/icon';
import type { ReadmeSection, TechSectionData } from '@/types/readme';

type ReadmeStudioProps = {
  sections: ReadmeSection[];
  onChangeSections: (sections: ReadmeSection[]) => void;
  outputLang: 'pt-BR' | 'en';
  genMode: 'ai' | 'heuristic' | 'manual';
  onBackToQuestions?: () => void;
  onReset?: () => void;
};

const PRESET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  heading: Type,
  tech_stack: Cpu,
  screenshots: ImageIcon,
  features: Sparkles,
  stats: BarChart3,
  socials: Users,
  api_endpoints: Plug,
  contributing: GitBranch,
  roadmap: Activity,
  divider: Minus,
};

const STATS_THEMES = ['tokyonight', 'dracula', 'radical', 'onedark', 'dark', 'gruvbox'];

const SOCIAL_PRESETS = [
  { name: 'GitHub', color: '181717', logo: 'github', logoColor: 'white', baseUrl: 'https://github.com/' },
  { name: 'LinkedIn', color: '0A66C2', logo: 'linkedin', logoColor: 'white', baseUrl: 'https://linkedin.com/in/' },
  { name: 'YouTube', color: 'FF0000', logo: 'youtube', logoColor: 'white', baseUrl: 'https://youtube.com/@' },
  { name: 'Discord', color: '5865F2', logo: 'discord', logoColor: 'white', baseUrl: 'https://discord.gg/' },
  { name: 'X', color: '000000', logo: 'x', logoColor: 'white', baseUrl: 'https://x.com/' },
  { name: 'Portfolio', color: '0EA5E9', logo: 'googlechrome', logoColor: 'white', baseUrl: 'https://' },
];

export function ReadmeStudio({
  sections,
  onChangeSections,
  outputLang,
  genMode,
  onBackToQuestions,
  onReset,
}: ReadmeStudioProps) {
  const [selectedId, setSelectedId] = useState<string>(() => sections[0]?.id ?? '');
  const [selectedIconName, setSelectedIconName] = useState<string | null>(null);
  const [expandedTechItem, setExpandedTechItem] = useState<string | null>(null);

  const [canvasTab, setCanvasTab] = useState<'canvas' | 'preview' | 'raw'>('canvas');
  const [techTab, setTechTab] = useState<'add' | 'edit'>('add');
  const [rightExtraTab, setRightExtraTab] = useState<'section' | 'extras' | 'reorder'>('section');

  const [badgeStyle, setBadgeStyle] = useState<BadgeStyle>('for-the-badge');
  const [iconQuery, setIconQuery] = useState('');
  const [iconProvider, setIconProvider] = useState<`${IconProviders}`>('devicons');

  const [statsUser, setStatsUser] = useState('');
  const [statsTheme, setStatsTheme] = useState('tokyonight');
  const [socialHandle, setSocialHandle] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [reorderMode, setReorderMode] = useState(false);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    sectionId: string;
    index: number;
  } | null>(null);

  const [copied, setCopied] = useState(false);

  const selectedSection = sections.find((s) => s.id === selectedId) ?? sections[0] ?? null;
  const filteredIcons = useMemo(() => searchTechIcons(iconQuery, 40), [iconQuery]);

  const fullMarkdown = useMemo(() => {
    return sections
      .filter((s) => s.enabled)
      .map((s) => s.markdown.trim())
      .filter(Boolean)
      .join('\n\n');
  }, [sections]);

  function updateSection(id: string, patch: Partial<ReadmeSection>) {
    onChangeSections(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function updateTechSection(id: string, updater: (prev: TechSectionData) => TechSectionData) {
    onChangeSections(
      sections.map((s) => {
        if (s.id !== id || !s.techData) return s;
        const nextTechData = updater(s.techData);
        return {
          ...s,
          techData: nextTechData,
          markdown: serializeTechSection(nextTechData, badgeStyle),
        };
      }),
    );
  }

  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const copy = [...sections];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    onChangeSections(copy);
  }

  function duplicateSection(index: number) {
    const original = sections[index];
    if (!original) return;
    const clone: ReadmeSection = {
      ...original,
      id: `${original.id}-copy-${Date.now()}`,
      title: `${original.title} (cópia)`,
      techData: original.techData
        ? { ...original.techData, icons: [...original.techData.icons] }
        : undefined,
    };
    const copy = [...sections];
    copy.splice(index + 1, 0, clone);
    onChangeSections(copy);
    setSelectedId(clone.id);
  }

  function deleteSection(id: string) {
    const next = sections.filter((s) => s.id !== id);
    onChangeSections(next);
    if (selectedId === id) {
      setSelectedId(next[0]?.id ?? '');
    }
  }

  function addPresetBlock(presetId: string) {
    const preset = STUDIO_BLOCK_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const created = preset.createSection(outputLang);
    onChangeSections([...sections, created]);
    setSelectedId(created.id);
    setRightExtraTab('section');
    if (created.kind === 'techs') {
      setTechTab('add');
    }
  }

  function handleBadgeStyleChange(nextStyle: BadgeStyle) {
    setBadgeStyle(nextStyle);
    onChangeSections(
      sections.map((s) => {
        if (s.kind === 'techs' && s.techData) {
          return { ...s, markdown: serializeTechSection(s.techData, nextStyle) };
        }
        return { ...s, markdown: applyBadgeStyleToMarkdown(s.markdown, nextStyle) };
      }),
    );
  }

  function getSectionTag(sec: ReadmeSection): 'h1' | 'h2' | 'h3' | 'h4' | 'p' {
    const clean = sec.markdown
      .replace(/^<div[^>]*>\s*/i, '')
      .replace(/\s*<\/div>$/i, '')
      .trim();
    if (clean.startsWith('#### ')) return 'h4';
    if (clean.startsWith('### ')) return 'h3';
    if (clean.startsWith('## ')) return 'h2';
    if (clean.startsWith('# ')) return 'h1';
    return 'p';
  }

  function handleSetSectionTag(tag: 'h1' | 'h2' | 'h3' | 'h4' | 'p') {
    if (!selectedSection) return;
    const alignMatch = selectedSection.markdown.match(/^<div align="(left|center|right)">/i);
    const align = alignMatch?.[1];
    const inner = selectedSection.markdown
      .replace(/^<div[^>]*>\s*\n?/i, '')
      .replace(/\n?\s*<\/div>$/i, '')
      .trim();
    const lines = inner.split('\n');
    const firstClean = lines[0].replace(/^#{1,6}\s+/, '');
    const prefix =
      tag === 'h1'
        ? '# '
        : tag === 'h2'
          ? '## '
          : tag === 'h3'
            ? '### '
            : tag === 'h4'
              ? '#### '
              : '';
    lines[0] = `${prefix}${firstClean}`;
    const rebuilt = lines.join('\n');
    const finalMd = align ? `<div align="${align}">\n\n${rebuilt}\n\n</div>` : rebuilt;
    updateSection(selectedSection.id, { markdown: finalMd });
  }

  function getSectionAlignment(sec: ReadmeSection): 'left' | 'center' | 'right' {
    if (sec.kind === 'techs' && sec.techData) return sec.techData.align;
    const m = sec.markdown.match(/^<div align="(left|center|right)">/i);
    return (m?.[1]?.toLowerCase() as 'left' | 'center' | 'right') || 'left';
  }

  function handleSetAlignment(align: 'left' | 'center' | 'right') {
    if (!selectedSection) return;
    if (selectedSection.kind === 'techs' && selectedSection.techData) {
      updateTechSection(selectedSection.id, (prev) => ({ ...prev, align }));
      return;
    }

    const unwrapped = selectedSection.markdown
      .replace(/^<div align="(left|center|right)">\s*\n?/i, '')
      .replace(/\n?<\/div>\s*$/i, '')
      .trim();

    const nextMarkdown =
      align === 'left' ? unwrapped : `<div align="${align}">\n\n${unwrapped}\n\n</div>`;
    updateSection(selectedSection.id, { markdown: nextMarkdown });
  }

  function handleToggleIcon(icon: Icon) {
    const targetTechSection =
      selectedSection?.kind === 'techs' && selectedSection.techData
        ? selectedSection
        : sections.find((s) => s.kind === 'techs' && s.techData);

    if (targetTechSection?.techData) {
      setSelectedId(targetTechSection.id);
      updateTechSection(targetTechSection.id, (prev) => {
        const exists = prev.icons.some((i) => i.name === icon.name);
        return {
          ...prev,
          icons: exists
            ? prev.icons.filter((i) => i.name !== icon.name)
            : [...prev.icons, iconToTechItem(icon, iconProvider)],
        };
      });
      return;
    }

    const techData: TechSectionData = {
      heading: outputLang === 'pt-BR' ? '## 🛠️ Tecnologias' : '## 🛠️ Tech Stack',
      align: 'left',
      height: 40,
      spacing: 12,
      icons: [iconToTechItem(icon, iconProvider)],
    };
    const created: ReadmeSection = {
      id: `techs-${Date.now()}`,
      title: outputLang === 'pt-BR' ? 'Tecnologias' : 'Tech Stack',
      kind: 'techs',
      techData,
      enabled: true,
      markdown: serializeTechSection(techData, badgeStyle),
    };
    onChangeSections([...sections, created]);
    setSelectedId(created.id);
  }

  function handleInsertStatsCard(type: 'stats' | 'langs' | 'streak') {
    if (!selectedSection) return;
    const username = statsUser.trim() || 'octocat';
    const url =
      type === 'stats'
        ? `https://github-readme-stats.vercel.app/api?username=${username}&show_icons=true&theme=${statsTheme}`
        : type === 'langs'
          ? `https://github-readme-stats.vercel.app/api/top-langs/?username=${username}&layout=compact&theme=${statsTheme}`
          : `https://streak-stats.demolab.com?user=${username}&theme=${statsTheme}`;

    const img = `![${username} ${type}](${url})`;
    updateSection(selectedSection.id, {
      markdown: `${selectedSection.markdown.trim()}\n\n${img}`,
    });
  }

  function handleInsertSocial(preset: (typeof SOCIAL_PRESETS)[number]) {
    if (!selectedSection) return;
    const handle = socialHandle.trim();
    const link = handle.startsWith('http') ? handle : `${preset.baseUrl}${handle}`;
    const badge = `[![${preset.name}](https://img.shields.io/badge/${preset.name}-${preset.color}?style=${badgeStyle}&logo=${preset.logo}&logoColor=${preset.logoColor})](${link})`;
    updateSection(selectedSection.id, {
      markdown: `${selectedSection.markdown.trim()} ${badge}`,
    });
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(fullMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const blob = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'README.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  const isTechSection = selectedSection?.kind === 'techs' && Boolean(selectedSection.techData);
  const activeTechSection =
    isTechSection && selectedSection
      ? selectedSection
      : sections.find((s) => s.kind === 'techs' && s.techData);
  const activeTechNames = new Set(activeTechSection?.techData?.icons.map((i) => i.name) ?? []);

  return (
    <div
      className="relative flex min-h-screen w-full flex-col p-3 text-white lg:h-screen lg:overflow-hidden"
      onClick={() => contextMenu && setContextMenu(null)}
    >
      <GridPulseBg bg="#161316" ink="#BABABA" accent="#FF6D29" calm={0.75} />

      {/* Main 3-Column Original Layout: Left Tile Grid | Floating Pills + Canvas + Footer | Right Inspector */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[260px_1fr_320px]">
        {/* LEFT PANEL: 2-Column Square Tile Grid */}
        <aside className="rounded-2xl border border-white/15 bg-[#453027]/20 p-3 backdrop-blur-2xl lg:overflow-y-auto">
          <div className="grid grid-cols-2 gap-2.5">
            {STUDIO_BLOCK_PRESETS.map((preset) => {
              const IconComp = PRESET_ICONS[preset.id] || Layers;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => addPresetBlock(preset.id)}
                  className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#161316]/60 p-3 text-center transition hover:border-[#FF6D29]/60 hover:bg-[#453027]/40"
                >
                  <IconComp className="h-6 w-6 stroke-[1.5] text-white" />
                  <span className="text-[11px] font-medium leading-tight text-[#BABABA]">
                    {preset.label}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* CENTER COLUMN: Floating Vertical Pills + Canvas + Footer Bar */}
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex min-h-0 flex-1 gap-2.5">
            {/* Floating Vertical Pill Toolbars */}
            <div className="hidden flex-col gap-2.5 pt-2 sm:flex">
              <div className="flex flex-col items-center gap-1 rounded-full border border-white/15 bg-[#453027]/25 p-1.5 backdrop-blur-xl">
                <button
                  type="button"
                  title="Reordenar seções"
                  onClick={() =>
                    setRightExtraTab((t) => (t === 'reorder' ? 'section' : 'reorder'))
                  }
                  className={`rounded-full p-2 transition ${
                    rightExtraTab === 'reorder'
                      ? 'bg-[#FF6D29] text-[#161316]'
                      : 'text-[#BABABA] hover:text-white'
                  }`}
                >
                  <ArrowUpDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Limpar canvas"
                  disabled={sections.length === 0}
                  onClick={() => {
                    if (window.confirm('Limpar todas as seções do canvas?')) {
                      onChangeSections([]);
                      setSelectedId('');
                    }
                  }}
                  className="rounded-full p-2 text-[#BABABA] transition hover:text-red-400 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col items-center gap-1 rounded-full border border-white/15 bg-[#453027]/25 p-1.5 backdrop-blur-xl">
                <button
                  type="button"
                  title="Canvas Visual"
                  onClick={() => setCanvasTab('canvas')}
                  className={`rounded-full p-2 transition ${
                    canvasTab === 'canvas'
                      ? 'bg-[#FF6D29] text-[#161316]'
                      : 'text-[#BABABA] hover:text-white'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Preview GitHub"
                  onClick={() => setCanvasTab('preview')}
                  className={`rounded-full p-2 transition ${
                    canvasTab === 'preview'
                      ? 'bg-[#FF6D29] text-[#161316]'
                      : 'text-[#BABABA] hover:text-white'
                  }`}
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Código Markdown"
                  onClick={() => setCanvasTab('raw')}
                  className={`rounded-full p-2 transition ${
                    canvasTab === 'raw'
                      ? 'bg-[#FF6D29] text-[#161316]'
                      : 'text-[#BABABA] hover:text-white'
                  }`}
                >
                  <Code2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Stats & Social"
                  onClick={() => setRightExtraTab((t) => (t === 'extras' ? 'section' : 'extras'))}
                  className={`rounded-full p-2 transition ${
                    rightExtraTab === 'extras'
                      ? 'bg-[#FF6D29] text-[#161316]'
                      : 'text-[#BABABA] hover:text-white'
                  }`}
                >
                  <BarChart3 className="h-4 w-4" />
                </button>
                {onReset && (
                  <button
                    type="button"
                    title="Novo projeto / Upload .md"
                    onClick={onReset}
                    className="rounded-full p-2 text-[#BABABA] transition hover:text-white"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Canvas Container */}
            <main className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/15 bg-[#161316]/75 p-5 backdrop-blur-2xl">
              {canvasTab === 'canvas' && sections.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center py-20 text-center">
                  <Sparkles className="mb-3 h-8 w-8 text-zinc-600" />
                  <p className="text-sm font-medium text-zinc-300">Canvas vazio</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Clique em qualquer bloco no painel à esquerda para começar.
                  </p>
                </div>
              )}

              {canvasTab === 'canvas' && sections.length > 0 && (
                <div className="space-y-2.5">
                  {sections.map((section, idx) => {
                    const isSelected = selectedSection?.id === section.id;
                    return (
                      <div
                        key={section.id}
                        draggable
                        onDragStart={() => setDragIndex(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (dragIndex === null || dragIndex === idx) return;
                          const copy = [...sections];
                          const [moved] = copy.splice(dragIndex, 1);
                          copy.splice(idx, 0, moved);
                          onChangeSections(copy);
                          setDragIndex(null);
                        }}
                        onDragEnd={() => setDragIndex(null)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setSelectedId(section.id);
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            sectionId: section.id,
                            index: idx,
                          });
                        }}
                        onClick={() => {
                          setSelectedId(section.id);
                          setSelectedIconName(null);
                          setRightExtraTab('section');
                        }}
                        className={`group relative cursor-pointer rounded-xl border px-4 py-3 transition ${
                          isSelected
                            ? 'border-[#FF6D29] bg-[#453027]/20'
                            : 'border-transparent hover:border-white/20'
                        } ${!section.enabled ? 'opacity-35' : ''} ${
                          dragIndex === idx ? 'opacity-50' : ''
                        }`}
                      >
                        {reorderMode && (
                          <div
                            className="absolute top-2 right-2 flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900 p-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveSection(idx, -1)}
                              className="rounded p-1 text-zinc-400 hover:text-white disabled:opacity-30"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === sections.length - 1}
                              onClick={() => moveSection(idx, 1)}
                              className="rounded p-1 text-zinc-400 hover:text-white disabled:opacity-30"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}

                        {section.kind === 'techs' && section.techData ? (
                          <div className="space-y-3">
                            {section.techData.heading && (
                              <div className="markdown-body">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {section.techData.heading}
                                </ReactMarkdown>
                              </div>
                            )}
                            <div
                              className="flex flex-wrap items-center"
                              style={{
                                justifyContent:
                                  section.techData.align === 'center'
                                    ? 'center'
                                    : section.techData.align === 'right'
                                      ? 'flex-end'
                                      : 'flex-start',
                                gap: `${section.techData.spacing}px`,
                              }}
                            >
                              {section.techData.icons.map((item) => {
                                const isIconSelected = selectedIconName === item.name;
                                return (
                                  <button
                                    key={item.name}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedId(section.id);
                                      setSelectedIconName(item.name);
                                      setExpandedTechItem(item.name);
                                      setRightExtraTab('section');
                                      setTechTab('edit');
                                    }}
                                    title={`${item.name} — clique para editar ou remover`}
                                    className={`rounded p-1 transition ${
                                      isIconSelected ? 'ring-1 ring-sky-400' : 'hover:bg-zinc-800/60'
                                    }`}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={resolveTechIconUrl(item, badgeStyle)}
                                      alt={`${item.name} logo`}
                                      style={{
                                        height:
                                          item.currentProvider === 'shields'
                                            ? '28px'
                                            : `${section.techData!.height}px`,
                                      }}
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <article className="markdown-body pointer-events-none text-sm">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                              {section.markdown}
                            </ReactMarkdown>
                          </article>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {canvasTab === 'preview' && (
                <article className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {fullMarkdown}
                  </ReactMarkdown>
                </article>
              )}

              {canvasTab === 'raw' && (
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-300">
                  {fullMarkdown}
                </pre>
              )}
            </main>
          </div>

          {/* Bottom Footer Bar */}
          <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-[#453027]/25 px-4 py-2.5 backdrop-blur-2xl">
            <div className="flex items-center gap-4 text-xs text-[#FF6D29]">
              <span className="font-medium text-[#BABABA]">
                Project README AI ({genMode === 'ai' ? 'AI' : genMode === 'manual' ? 'Manual' : 'Heurístico'})
              </span>
              {onBackToQuestions && (
                <button type="button" onClick={onBackToQuestions} className="hover:underline">
                  Voltar às perguntas
                </button>
              )}
              <button type="button" onClick={handleCopy} className="inline-flex items-center gap-1 hover:underline">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado!' : 'Copiar Markdown'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {canvasTab !== 'canvas' && (
                <button
                  type="button"
                  onClick={() => setCanvasTab('canvas')}
                  className="rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-medium text-white hover:bg-white/20"
                >
                  ← Voltar ao Editor
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (canvasTab === 'canvas') {
                    setCanvasTab('preview');
                  } else {
                    handleDownload();
                  }
                }}
                className="inline-flex items-center gap-2 rounded-full bg-[#FF6D29] px-5 py-2 text-xs font-semibold text-[#161316] shadow-lg shadow-[#FF6D29]/20 transition hover:bg-[#ff8147]"
              >
                {canvasTab === 'canvas' ? (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    Gerar README
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    Baixar README.md
                  </>
                )}
              </button>
            </div>
          </footer>
        </div>

        {/* RIGHT INSPECTOR */}
        <aside className="flex min-h-0 flex-col rounded-2xl border border-white/15 bg-[#453027]/20 backdrop-blur-2xl lg:overflow-y-auto">
          {rightExtraTab === 'reorder' ? (
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-zinc-200">
                  Reordenar Seções ({sections.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setRightExtraTab('section')}
                  className="text-xs text-sky-400 hover:underline"
                >
                  Concluir
                </button>
              </div>
              <div className="space-y-1.5">
                {sections.map((sec, idx) => (
                  <div
                    key={sec.id}
                    className="flex items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-950 px-2.5 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(sec.id)}
                      className="min-w-0 flex-1 truncate text-left text-xs text-zinc-200"
                    >
                      {sec.title}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveSection(idx, -1)}
                        className="rounded p-1 text-zinc-400 hover:text-white disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === sections.length - 1}
                        onClick={() => moveSection(idx, 1)}
                        className="rounded p-1 text-zinc-400 hover:text-white disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSection(sec.id)}
                        className="rounded p-1 text-zinc-400 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : rightExtraTab === 'extras' ? (
            <div className="space-y-5 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-zinc-200">GitHub Stats & Social</h2>
                <button
                  type="button"
                  onClick={() => setRightExtraTab('section')}
                  className="text-xs text-sky-400 hover:underline"
                >
                  Voltar
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-400">GitHub Stats Cards</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    value={statsUser}
                    onChange={(e) => setStatsUser(e.target.value)}
                    placeholder="username"
                    className="rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 focus:border-sky-500 focus:outline-none"
                  />
                  <select
                    value={statsTheme}
                    onChange={(e) => setStatsTheme(e.target.value)}
                    className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
                  >
                    {STATS_THEMES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleInsertStatsCard('stats')}
                    className="rounded border border-zinc-800 bg-zinc-950 py-1.5 text-[11px] hover:border-zinc-600"
                  >
                    + Stats
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertStatsCard('langs')}
                    className="rounded border border-zinc-800 bg-zinc-950 py-1.5 text-[11px] hover:border-zinc-600"
                  >
                    + Langs
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertStatsCard('streak')}
                    className="rounded border border-zinc-800 bg-zinc-950 py-1.5 text-[11px] hover:border-zinc-600"
                  >
                    + Streak
                  </button>
                </div>
              </div>

              <div className="space-y-2 border-t border-zinc-800 pt-4">
                <p className="text-xs font-medium text-zinc-400">Redes Sociais</p>
                <input
                  type="text"
                  value={socialHandle}
                  onChange={(e) => setSocialHandle(e.target.value)}
                  placeholder="@usuario ou URL"
                  className="w-full rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 focus:border-sky-500 focus:outline-none"
                />
                <div className="grid grid-cols-3 gap-1.5">
                  {SOCIAL_PRESETS.map((social) => (
                    <button
                      key={social.name}
                      type="button"
                      onClick={() => handleInsertSocial(social)}
                      className="rounded border border-zinc-800 bg-zinc-950 py-1.5 text-[11px] hover:border-zinc-600"
                    >
                      + {social.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : !selectedSection ? (
            <p className="p-4 text-xs text-zinc-500">Selecione um bloco no canvas para editar.</p>
          ) : isTechSection && selectedSection.techData ? (
            /* TECHS INSPECTOR: + Adicionar | ✎ Editar + Visual Variants (screenshot 2) */
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="grid grid-cols-2 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => setTechTab('add')}
                  className={`border-b-2 py-3 text-xs font-medium transition ${
                    techTab === 'add'
                      ? 'border-[#FF6D29] text-white'
                      : 'border-transparent text-[#BABABA] hover:text-white'
                  }`}
                >
                  + Adicionar
                </button>
                <button
                  type="button"
                  onClick={() => setTechTab('edit')}
                  className={`border-b-2 py-3 text-xs font-medium transition ${
                    techTab === 'edit'
                      ? 'border-[#FF6D29] text-white'
                      : 'border-transparent text-[#BABABA] hover:text-white'
                  }`}
                >
                  ✎ Editar ({selectedSection.techData.icons.length})
                </button>
              </div>

              {techTab === 'add' ? (
                <div className="space-y-3 overflow-y-auto p-4">
                  <select
                    value={iconProvider}
                    onChange={(e) => setIconProvider(e.target.value as `${IconProviders}`)}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-zinc-200 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="devicons">Devicons (SVG)</option>
                    <option value="shields">Shields (Badge)</option>
                    <option value="skill_icons">Skill Icons</option>
                    <option value="simple_icons">Simple Icons</option>
                  </select>

                  <div className="relative">
                    <Search className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-zinc-500" />
                    <input
                      type="text"
                      value={iconQuery}
                      onChange={(e) => setIconQuery(e.target.value)}
                      placeholder="Buscar tecnologia..."
                      className="w-full rounded border border-zinc-800 bg-zinc-950 py-2 pr-3 pl-8 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {filteredIcons.map((icon) => {
                      const isAdded = activeTechNames.has(icon.name);
                      const previewProvider = icon.providers[iconProvider]
                        ? iconProvider
                        : icon.available_providers[0];
                      const previewUrl =
                        icon.providers[
                          previewProvider === 'shields' && icon.providers.simple_icons
                            ? 'simple_icons'
                            : previewProvider
                        ]?.path || icon.providers[previewProvider]?.path;
                      return (
                        <button
                          key={icon.name}
                          type="button"
                          onClick={() => handleToggleIcon(icon)}
                          title={isAdded ? `Remover ${icon.name}` : `Adicionar ${icon.name}`}
                          className={`relative flex flex-col items-center justify-center gap-1 rounded border p-2 transition ${
                            isAdded
                              ? 'border-emerald-500/60 bg-emerald-500/10'
                              : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600'
                          }`}
                        >
                          {isAdded && (
                            <Check className="absolute top-1 right-1 h-3 w-3 text-emerald-400" />
                          )}
                          {previewUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={previewUrl}
                              alt={icon.name}
                              className="h-6 w-6 object-contain"
                              loading="lazy"
                            />
                          )}
                          <span className="w-full truncate text-center text-[10px] text-zinc-400">
                            {icon.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto p-4">
                  {/* Global Tech Section Styles */}
                  <div className="space-y-2 border-b border-zinc-800 pb-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[11px] text-zinc-400">
                          Altura ({selectedSection.techData.height}px)
                        </label>
                        <input
                          type="range"
                          min={24}
                          max={72}
                          step={4}
                          value={selectedSection.techData.height}
                          onChange={(e) =>
                            updateTechSection(selectedSection.id, (prev) => ({
                              ...prev,
                              height: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-sky-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-zinc-400">
                          Espaço ({selectedSection.techData.spacing}px)
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={32}
                          step={4}
                          value={selectedSection.techData.spacing}
                          onChange={(e) =>
                            updateTechSection(selectedSection.id, (prev) => ({
                              ...prev,
                              spacing: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-sky-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tech Items with Visual Variantes (matching screenshot 2) */}
                  <div className="space-y-2">
                    {selectedSection.techData.icons.map((item, itemIdx) => {
                      const currentProv = item.providers[item.currentProvider];
                      const variants = currentProv?.variants || [];
                      const isExpanded = expandedTechItem === item.name;
                      return (
                        <div
                          key={item.name}
                          className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  disabled={itemIdx === 0}
                                  onClick={() =>
                                    updateTechSection(selectedSection.id, (prev) => {
                                      const copy = [...prev.icons];
                                      const [moved] = copy.splice(itemIdx, 1);
                                      copy.splice(itemIdx - 1, 0, moved);
                                      return { ...prev, icons: copy };
                                    })
                                  }
                                  className="text-zinc-500 hover:text-white disabled:opacity-20"
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={itemIdx === selectedSection.techData!.icons.length - 1}
                                  onClick={() =>
                                    updateTechSection(selectedSection.id, (prev) => {
                                      const copy = [...prev.icons];
                                      const [moved] = copy.splice(itemIdx, 1);
                                      copy.splice(itemIdx + 1, 0, moved);
                                      return { ...prev, icons: copy };
                                    })
                                  }
                                  className="text-zinc-500 hover:text-white disabled:opacity-20"
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </button>
                              </div>

                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={resolveTechIconUrl(item, badgeStyle)}
                                alt={item.name}
                                className="h-7 w-7 shrink-0 object-contain"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium capitalize text-zinc-100">
                                  {item.name}
                                </p>
                                <p className="text-[11px] text-sky-400">{item.currentProvider}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                title="Remover"
                                onClick={() =>
                                  updateTechSection(selectedSection.id, (prev) => ({
                                    ...prev,
                                    icons: prev.icons.filter((ic) => ic.name !== item.name),
                                  }))
                                }
                                className="rounded p-1.5 text-zinc-400 hover:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Editar variantes / provider"
                                onClick={() =>
                                  setExpandedTechItem(isExpanded ? null : item.name)
                                }
                                className={`rounded p-1.5 ${
                                  isExpanded ? 'text-sky-400' : 'text-zinc-400 hover:text-white'
                                }`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-3 space-y-2.5 border-t border-zinc-800/80 pt-2.5">
                              <div>
                                <label className="mb-1 block text-[11px] text-zinc-400">
                                  Provedor
                                </label>
                                <select
                                  value={item.currentProvider}
                                  onChange={(e) =>
                                    updateTechSection(selectedSection.id, (prev) => ({
                                      ...prev,
                                      icons: prev.icons.map((ic) =>
                                        ic.name === item.name
                                          ? {
                                              ...ic,
                                              currentProvider: e.target.value as `${IconProviders}`,
                                              variantIndex: 0,
                                            }
                                          : ic,
                                      ),
                                    }))
                                  }
                                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
                                >
                                  {item.available_providers.map((p) => (
                                    <option key={p} value={p}>
                                      {p}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {variants.length > 1 && (
                                <div>
                                  <p className="mb-1.5 text-[11px] text-zinc-400">Variantes</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {variants.map((variantUrl, vIdx) => (
                                      <button
                                        key={variantUrl}
                                        type="button"
                                        onClick={() =>
                                          updateTechSection(selectedSection.id, (prev) => ({
                                            ...prev,
                                            icons: prev.icons.map((ic) =>
                                              ic.name === item.name
                                                ? { ...ic, variantIndex: vIdx }
                                                : ic,
                                            ),
                                          }))
                                        }
                                        className={`rounded border p-1.5 transition ${
                                          item.variantIndex === vIdx
                                            ? 'border-sky-500 bg-sky-500/10'
                                            : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
                                        }`}
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={variantUrl}
                                          alt={`${item.name} variant ${vIdx + 1}`}
                                          className="h-7 w-7 object-contain"
                                        />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* TEXT / MARKDOWN INSPECTOR: Layout + Conteúdo (matching screenshot 1) */
            <div className="space-y-5 overflow-y-auto p-4">
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-zinc-200">Layout</h3>
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-400">Alinhamento</label>
                  <select
                    value={getSectionAlignment(selectedSection)}
                    onChange={(e) =>
                      handleSetAlignment(e.target.value as 'left' | 'center' | 'right')
                    }
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="left">Esquerda</option>
                    <option value="center">Centro</option>
                    <option value="right">Direita</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2.5 border-t border-zinc-800 pt-4">
                <h3 className="text-xs font-semibold text-zinc-200">Conteúdo</h3>
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-400">Texto</label>
                  <textarea
                    rows={12}
                    value={selectedSection.markdown}
                    onChange={(e) =>
                      updateSection(selectedSection.id, { markdown: e.target.value })
                    }
                    className="w-full rounded border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-200 focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] text-zinc-400">Tag</label>
                  <select
                    value={getSectionTag(selectedSection)}
                    onChange={(e) =>
                      handleSetSectionTag(e.target.value as 'h1' | 'h2' | 'h3' | 'h4' | 'p')
                    }
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="h1">H1</option>
                    <option value="h2">H2</option>
                    <option value="h3">H3</option>
                    <option value="h4">H4</option>
                    <option value="p">Parágrafo (P)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] text-zinc-400">Estilo dos Badges</label>
                  <select
                    value={badgeStyle}
                    onChange={(e) => handleBadgeStyleChange(e.target.value as BadgeStyle)}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="for-the-badge">For the badge</option>
                    <option value="flat">Flat</option>
                    <option value="flat-square">Flat square</option>
                    <option value="plastic">Plastic</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Right-click Context Menu (like profile-readme-generator) */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 w-48 rounded-xl border border-white/15 bg-[#161316]/95 p-1.5 text-xs text-white shadow-2xl backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            disabled={contextMenu.index === 0}
            onClick={() => {
              moveSection(contextMenu.index, -1);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left hover:bg-zinc-800 disabled:opacity-40"
          >
            <ArrowUp className="h-3.5 w-3.5 text-zinc-400" />
            Mover para cima
          </button>
          <button
            type="button"
            disabled={contextMenu.index === sections.length - 1}
            onClick={() => {
              moveSection(contextMenu.index, 1);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left hover:bg-zinc-800 disabled:opacity-40"
          >
            <ArrowDown className="h-3.5 w-3.5 text-zinc-400" />
            Mover para baixo
          </button>
          <button
            type="button"
            onClick={() => {
              duplicateSection(contextMenu.index);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left hover:bg-zinc-800"
          >
            <CopyPlus className="h-3.5 w-3.5 text-zinc-400" />
            Duplicar
          </button>
          <div className="my-1 border-t border-zinc-800" />
          <div className="flex items-center justify-between px-2.5 py-1">
            <span className="text-[11px] text-zinc-400">Alinhar:</span>
            <div className="flex gap-1">
              {(['left', 'center', 'right'] as const).map((al) => (
                <button
                  key={al}
                  type="button"
                  onClick={() => {
                    setSelectedId(contextMenu.sectionId);
                    handleSetAlignment(al);
                    setContextMenu(null);
                  }}
                  className="rounded p-1 hover:bg-zinc-800"
                >
                  {al === 'left' && <AlignLeft className="h-3 w-3" />}
                  {al === 'center' && <AlignCenter className="h-3 w-3" />}
                  {al === 'right' && <AlignRight className="h-3 w-3" />}
                </button>
              ))}
            </div>
          </div>
          <div className="my-1 border-t border-zinc-800" />
          <button
            type="button"
            onClick={() => {
              deleteSection(contextMenu.sectionId);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-red-400 hover:bg-red-500/15"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Deletar seção
          </button>
        </div>
      )}
    </div>
  );
}
