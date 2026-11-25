import { NextResponse } from 'next/server';
import { generateReadme } from '@/lib/ai/generator';
import type { AnalysisResult, RepoScanSummary } from '@/types/readme';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      scan?: RepoScanSummary;
      analysis?: AnalysisResult;
      answers?: Record<string, string>;
      outputLang?: 'pt-BR' | 'en';
    };

    if (!body.scan || !body.analysis) {
      return NextResponse.json({ error: 'Dados do scan e análise são obrigatórios.' }, { status: 400 });
    }

    const result = await generateReadme(
      body.scan,
      body.analysis,
      body.answers || {},
      body.outputLang || 'pt-BR',
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao gerar README.md.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
