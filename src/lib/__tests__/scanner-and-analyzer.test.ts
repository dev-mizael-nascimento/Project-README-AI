import { describe, expect, it } from 'vitest';
import { heuristicAnalyze } from '@/lib/ai/analyzer';
import { generateReadme } from '@/lib/ai/generator';
import { buildTechBadgesMarkdown } from '@/lib/badges';
import { parseGitHubUrl } from '@/lib/github/scanner';
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
});
