import { NextResponse } from 'next/server';
import {
  analyzeFreePrompt,
  analyzeRepository,
} from '@/lib/ai/analyzer';
import { scanGitHubRepo } from '@/lib/github/scanner';
import { isGitHubRepoInput } from '@/lib/input-detector';
import type { RepoScanSummary } from '@/types/readme';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      repoUrl?: string;
      localMarkdown?: string;
      fileName?: string;
      outputLang?: 'pt-BR' | 'en';
    };

    const outputLang = body.outputLang || 'pt-BR';

    if (body.localMarkdown?.trim()) {
      const headingMatch = body.localMarkdown.match(/^#\s+(.+)$/m);
      const inferredName =
        headingMatch?.[1]?.replace(/[^\w\s-]/g, '').trim() ||
        body.fileName?.replace(/\.(md|markdown|txt)$/i, '') ||
        'my-project';

      const scan: RepoScanSummary = {
        owner: 'local',
        repo: inferredName,
        url: 'https://github.com/owner/repo',
        defaultBranch: 'main',
        description: null,
        homepage: null,
        license: null,
        topics: [],
        tree: ['README.md'],
        keyFiles: [
          {
            path: 'README.md',
            content: body.localMarkdown.slice(0, 12000),
          },
        ],
      };

      const analysis = await analyzeRepository(scan, outputLang);
      return NextResponse.json({ scan, analysis });
    }

    const input = body.repoUrl?.trim() || '';
    if (!input) {
      return NextResponse.json(
        { error: 'Informe um link do GitHub, descreva seu projeto ou anexe um .md.' },
        { status: 400 },
      );
    }

    if (isGitHubRepoInput(input)) {
      const scan = await scanGitHubRepo(input);
      const analysis = await analyzeRepository(scan, outputLang);
      return NextResponse.json({ scan, analysis });
    }

    // Free-text prompt mode
    const freeResult = await analyzeFreePrompt(input, outputLang);
    if (freeResult.kind === 'off_topic') {
      return NextResponse.json({ offTopicReply: freeResult.reply });
    }

    return NextResponse.json({ scan: freeResult.scan, analysis: freeResult.analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao analisar entrada.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
