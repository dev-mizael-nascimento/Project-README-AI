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
import { detectRepoLogoUrl, parseGitHubUrl } from '@/lib/github/scanner';
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

  it('detects repository logo image and encodes spaces in raw GitHub URL', () => {
    const logo = detectRepoLogoUrl(
      [
        'docs/preview.png',
        'RB Psicanalise - Sistema de Fichas/04_Identidade_Visual/Logotipo minimalista de Psicanálise.png',
      ],
      'dev-mizael-nascimento',
      'RB-Psican-lise',
      'main',
    );
    expect(logo).toBe(
      'https://raw.githubusercontent.com/dev-mizael-nascimento/RB-Psican-lise/main/RB%20Psicanalise%20-%20Sistema%20de%20Fichas/04_Identidade_Visual/Logotipo%20minimalista%20de%20Psican%C3%A1lise.png',
    );
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

  it('detects languages and .env.example inside subfolders (e.g. Flask web app)', () => {
    const nestedScan: RepoScanSummary = {
      owner: 'dev-mizael-nascimento',
      repo: 'RB-Psican-lise',
      url: 'https://github.com/dev-mizael-nascimento/RB-Psican-lise',
      defaultBranch: 'main',
      description: null,
      homepage: null,
      license: null,
      topics: [],
      languages: { Python: 52000, HTML: 31000, CSS: 12000, JavaScript: 8400 },
      tree: [
        '.github/workflows/build-windows-exe.yml',
        'RB_Psicanalise_Web/app.py',
        'RB_Psicanalise_Web/requirements.txt',
        'RB_Psicanalise_Web/.env.example',
        'RB_Psicanalise_Web/templates/index.html',
        'RB_Psicanalise_Web/static/style.css',
        'RB_Psicanalise_Web/static/main.js',
      ],
      keyFiles: [
        {
          path: 'RB_Psicanalise_Web/requirements.txt',
          content: 'Flask==3.0.0\nSQLAlchemy==2.0.0',
        },
        {
          path: 'RB_Psicanalise_Web/.env.example',
          content: 'FLASK_ENV=development\nSECRET_KEY=changeme\nDATABASE_URL=sqlite:///rb_psicanalise.db',
        },
      ],
    };

    const analysis = heuristicAnalyze(nestedScan, 'pt-BR');
    expect(analysis.detectedLanguages).toEqual(
      expect.arrayContaining(['Python', 'HTML', 'CSS', 'JavaScript']),
    );
    expect(analysis.detectedFrameworks).toContain('Flask');
    expect(analysis.detectedTools).toEqual(expect.arrayContaining(['SQLite', 'SQLAlchemy', 'GitHub Actions']));
    expect(analysis.detectedEnvVars).toEqual(['FLASK_ENV', 'SECRET_KEY', 'DATABASE_URL']);
    expect(analysis.questions.some((q) => q.id === 'env_vars')).toBe(false);
  });

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
