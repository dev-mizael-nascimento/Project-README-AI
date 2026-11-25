import { NextResponse } from 'next/server';
import { analyzeRepository } from '@/lib/ai/analyzer';
import { scanGitHubRepo } from '@/lib/github/scanner';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      repoUrl?: string;
      outputLang?: 'pt-BR' | 'en';
    };

    if (!body.repoUrl?.trim()) {
      return NextResponse.json({ error: 'Informe a URL do repositório GitHub.' }, { status: 400 });
    }

    const scan = await scanGitHubRepo(body.repoUrl);
    const analysis = await analyzeRepository(scan, body.outputLang || 'pt-BR');

    return NextResponse.json({ scan, analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao analisar repositório.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
