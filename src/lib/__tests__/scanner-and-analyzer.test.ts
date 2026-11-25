import { describe, expect, it } from 'vitest';
import {
  heuristicAnalyze,
  heuristicAnalyzeFreePrompt,
} from '@/lib/ai/analyzer';
import { isGitHubRepoInput } from '@/lib/input-detector';
import { generateReadme } from '@/lib/ai/generator';
import {
  applyBadgeStyleToMarkdown,
  buildTechBadgesMarkdown,
  findTechIcon,
  renderTechIconSnippet,
  searchTechIcons,
} from '@/lib/badges';
import { parseGitHubUrl } from '@/lib/github/scanner';
import { splitMarkdownIntoSections } from '@/lib/markdown-splitter';
import { STUDIO_BLOCK_PRESETS } from '@/lib/studio-blocks';
import { buildTechItemsFromNames, serializeTechSection } from '@/lib/tech-serializer';
import type { RepoScanSummary } from '@/types/readme';

describe('parseGitHubUrl', () => {
  it('parses full GitHub URL and short owner/repo format', () => {
    expect(parseGitHubUrl('https://github.com/vercel/next.js')).toEqual({
      owner: 'vercel',
      repo: 'next.js',
    });
    expect(parseGitHubUrl('maurodesouza/profile-readme-generator')).toEqual({
      owner: 'maurodesouza',
      repo: 'profile-readme-generator',
    });
  });

  it('throws on invalid non-GitHub URL', () => {
    expect(() => parseGitHubUrl('https://gitlab.com/foo/bar')).toThrow();
  });
});

describe('heuristicAnalyze and generateReadme', () => {
  const mockScan: RepoScanSummary = {
    owner: 'acme',
    repo: 'awesome-app',
    url: 'https://github.com/acme/awesome-app',
    defaultBranch: 'main',
    description: null,
    homepage: null,
    license: 'MIT',
    topics: ['nextjs'],
    tree: ['package.json', 'src/app/page.tsx', 'Dockerfile'],
    keyFiles: [
      {
        path: 'package.json',
        content: JSON.stringify({
          packageManager: 'pnpm@10.0.0',
          scripts: { dev: 'next dev', test: 'vitest run' },
          dependencies: { next: '16.0.0', react: '19.0.0' },
          devDependencies: { vitest: '3.1.0' },
        }),
      },
      {
        path: '.env.example',
        content: 'DATABASE_URL=postgres://...\nGEMINI_API_KEY=',
      },
    ],
  };

  it('detects stack, scripts, env vars and generates targeted questions', () => {
    const analysis = heuristicAnalyze(mockScan, 'pt-BR');
    expect(analysis.detectedLanguages).toContain('TypeScript');
    expect(analysis.detectedFrameworks).toContain('Next.js');
    expect(analysis.detectedTools).toContain('Docker');
    expect(analysis.detectedTools).toContain('pnpm');
    expect(analysis.detectedEnvVars).toEqual(['DATABASE_URL', 'GEMINI_API_KEY']);
    expect(analysis.questions.some((q) => q.id === 'goal')).toBe(true);
    expect(analysis.questions.some((q) => q.id === 'env_vars')).toBe(false);
  });

  it('generates structured README sections and badges', async () => {
    const badges = buildTechBadgesMarkdown(['TypeScript', 'Next.js']);
    expect(badges).toContain('shields.io/badge/TypeScript');

    const analysis = heuristicAnalyze(mockScan, 'pt-BR');
    const result = await generateReadme(mockScan, analysis, {
      goal: 'Gerador de README inteligente.',
    });
    expect(result.mode).toBe('heuristic');
    expect(result.sections.some((s) => s.id === 'header')).toBe(true);
    expect(result.sections.some((s) => s.id === 'installation')).toBe(true);
    expect(result.sections.some((s) => s.id === 'env')).toBe(true);
  });

  it('updates badge styles, searches full catalog including new icons, and creates preset blocks', () => {
    const md = buildTechBadgesMarkdown(['TypeScript', 'Docker'], 'for-the-badge');
    const flat = applyBadgeStyleToMarkdown(md, 'flat-square');
    expect(flat).toContain('style=flat-square');
    expect(flat).not.toContain('style=for-the-badge');

    const claude = findTechIcon('claude');
    expect(claude).toBeDefined();
    expect(searchTechIcons('bun').some((i) => i.name === 'bun')).toBe(true);
    expect(renderTechIconSnippet(claude!, 'devicons', { height: 40 })).toContain('<img src=');

    const block = STUDIO_BLOCK_PRESETS[0].createSection('en');
    expect(block.enabled).toBe(true);
    expect(block.markdown.length).toBeGreaterThan(0);
  });

  it('splits local markdown directly into studio sections without AI', () => {
    const md = `# My App\n\nIntro\n\n## Features\n\n- Fast\n\n## License\n\nMIT`;
    const sections = splitMarkdownIntoSections(md);
    expect(sections).toHaveLength(3);
    expect(sections[0].title).toBe('My App');
    expect(sections[1].title).toBe('Features');
    expect(sections[2].title).toBe('License');
  });

  it('builds and serializes structured Techs section like profile-readme-generator', () => {
    const icons = buildTechItemsFromNames(['TypeScript', 'claude', 'bun'], 'devicons');
    expect(icons.length).toBeGreaterThanOrEqual(2);
    const md = serializeTechSection({
      heading: '## Tech Stack',
      align: 'center',
      height: 40,
      spacing: 12,
      icons,
    });
    expect(md).toContain('<div align="center">');
    expect(md).toContain('height="40"');
    expect(md).toContain('<img width="12" />');
  });

  it('distinguishes GitHub URLs, free project prompts, and off-topic text', () => {
    expect(isGitHubRepoInput('https://github.com/vercel/next.js')).toBe(true);
    expect(isGitHubRepoInput('vercel/next.js')).toBe(true);
    expect(isGitHubRepoInput('Quero um README para minha API em Node')).toBe(false);

    const offTopic = heuristicAnalyzeFreePrompt('receita de bolo', 'pt-BR');
    expect(offTopic.kind).toBe('off_topic');

    const projectPrompt = heuristicAnalyzeFreePrompt(
      'Quero um README para um SaaS em Next.js com TypeScript e Prisma',
      'pt-BR',
    );
    expect(projectPrompt.kind).toBe('readme_request');
  });
});
