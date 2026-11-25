import { generateJsonWithGemini } from '@/lib/ai/client';
import type { AnalysisResult, ClarificationQuestion, RepoScanSummary } from '@/types/readme';

/** Heuristic fallback analyzer that works without an AI key. */
export function heuristicAnalyze(scan: RepoScanSummary, outputLang: 'pt-BR' | 'en' = 'pt-BR'): AnalysisResult {
  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const tools = new Set<string>();
  let detectedScripts: Record<string, string> = {};
  const detectedEnvVars = new Set<string>();

  for (const p of scan.tree) {
    if (p.endsWith('.ts') || p.endsWith('.tsx')) languages.add('TypeScript');
    else if (p.endsWith('.js') || p.endsWith('.jsx') || p.endsWith('.mjs')) languages.add('JavaScript');
    else if (p.endsWith('.py')) languages.add('Python');
    else if (p.endsWith('.go')) languages.add('Go');
    else if (p.endsWith('.rs')) languages.add('Rust');
    else if (p.endsWith('.php')) languages.add('PHP');
    else if (p.endsWith('.java')) languages.add('Java');

    if (p.includes('Dockerfile') || p.includes('docker-compose')) tools.add('Docker');
  }

  const pkgFile = scan.keyFiles.find((f) => f.path === 'package.json');
  if (pkgFile) {
    try {
      const pkg = JSON.parse(pkgFile.content) as {
        scripts?: Record<string, string>;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        packageManager?: string;
      };
      detectedScripts = pkg.scripts || {};
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (allDeps.next) frameworks.add('Next.js');
      if (allDeps.react) frameworks.add('React');
      if (allDeps.vue) frameworks.add('Vue');
      if (allDeps.svelte) frameworks.add('Svelte');
      if (allDeps.express) frameworks.add('Express');
      if (allDeps.fastify) frameworks.add('Fastify');
      if (allDeps.tailwindcss || allDeps['@tailwindcss/postcss']) frameworks.add('TailwindCSS');
      if (allDeps.prisma || allDeps['@prisma/client']) tools.add('Prisma');
      if (allDeps['drizzle-orm']) tools.add('Drizzle');
      if (allDeps.vitest) tools.add('Vitest');
      if (allDeps.jest) tools.add('Jest');
      if (allDeps['@playwright/test'] || allDeps.playwright) tools.add('Playwright');
      if (pkg.packageManager?.startsWith('pnpm')) tools.add('pnpm');
    } catch {
      // Ignore malformed package.json
    }
  }

  const pyFile = scan.keyFiles.find((f) => f.path === 'pyproject.toml' || f.path === 'requirements.txt');
  if (pyFile) {
    languages.add('Python');
    const lower = pyFile.content.toLowerCase();
    if (lower.includes('fastapi')) frameworks.add('FastAPI');
    if (lower.includes('django')) frameworks.add('Django');
    if (lower.includes('flask')) frameworks.add('Flask');
  }

  const envFile = scan.keyFiles.find((f) => f.path.startsWith('.env.'));
  if (envFile) {
    for (const line of envFile.content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) detectedEnvVars.add(trimmed.slice(0, eq).trim());
    }
  }

  const missingInfo: string[] = [];
  const questions: ClarificationQuestion[] = [];
  const isPt = outputLang === 'pt-BR';

  if (!scan.description) {
    missingInfo.push(isPt ? 'Objetivo principal do projeto' : 'Main project goal');
    questions.push({
      id: 'goal',
      question: isPt
        ? 'Qual problema principal este projeto resolve e para quem ele foi feito?'
        : 'What main problem does this project solve and who is it for?',
      placeholder: isPt
        ? 'Ex.: Plataforma para automatizar atendimentos via WhatsApp...'
        : 'e.g. A CLI tool to automate database migrations...',
      required: true,
    });
  }

  if (detectedEnvVars.size === 0) {
    missingInfo.push(isPt ? 'Variáveis de ambiente obrigatórias' : 'Required environment variables');
    questions.push({
      id: 'env_vars',
      question: isPt
        ? 'O projeto precisa de variáveis de ambiente (.env) para rodar? Se sim, quais?'
        : 'Does the project require any environment variables (.env) to run? If so, which ones?',
      placeholder: isPt
        ? 'Ex.: DATABASE_URL, GEMINI_API_KEY (ou deixe em branco se não precisar)'
        : 'e.g. DATABASE_URL, API_KEY (leave blank if none)',
    });
  }

  if (!scan.homepage) {
    missingInfo.push(isPt ? 'Link de demo ou produção' : 'Live demo or production URL');
    questions.push({
      id: 'demo_url',
      question: isPt
        ? 'Existe algum link de demonstração (deploy) ou exemplo de uso que queira destacar?'
        : 'Is there a live demo URL or usage example you want to highlight?',
      placeholder: 'https://...',
    });
  }

  questions.push({
    id: 'extra_features',
    question: isPt
      ? 'Quais são os principais diferenciais ou funcionalidades que não ficam óbvios só olhando as pastas?'
      : 'What key features or highlights are not obvious from the folder structure alone?',
    placeholder: isPt
      ? 'Ex.: Suporte a múltiplos idiomas, exportação em PDF, cache em Redis...'
      : 'e.g. Multi-tenant auth, real-time sync, zero-config CLI...',
  });

  return {
    mode: 'heuristic',
    projectName: scan.repo,
    summary:
      scan.description ||
      (isPt
        ? `Projeto ${scan.repo} utilizando ${[...languages, ...frameworks].join(', ') || 'código-fonte estruturado'}.`
        : `${scan.repo} project built with ${[...languages, ...frameworks].join(', ') || 'modern tooling'}.`),
    detectedLanguages: [...languages],
    detectedFrameworks: [...frameworks],
    detectedTools: [...tools],
    detectedScripts,
    detectedEnvVars: [...detectedEnvVars],
    missingInfo,
    questions,
  };
}

/** Analyze a scanned repository using Gemini AI (with automatic heuristic fallback). */
export async function analyzeRepository(
  scan: RepoScanSummary,
  outputLang: 'pt-BR' | 'en' = 'pt-BR',
  apiKey?: string,
): Promise<AnalysisResult> {
  const key = apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  const baseline = heuristicAnalyze(scan, outputLang);

  if (!key) {
    return baseline;
  }

  const targetLanguage = outputLang === 'en' ? 'English (en-US)' : 'Brazilian Portuguese (pt-BR)';

  try {
    const prompt = `
You are a senior software architect analyzing a GitHub repository to write a top-tier, visually polished README.md.
Carefully inspect the repository metadata, file tree, config files, and source entrypoints below.

Return ONLY valid JSON matching this exact TypeScript shape:
{
  "projectName": string,
  "summary": string,
  "detectedLanguages": string[],
  "detectedFrameworks": string[],
  "detectedTools": string[],
  "detectedScripts": Record<string, string>,
  "detectedEnvVars": string[],
  "missingInfo": string[],
  "questions": Array<{ "id": string, "question": string, "placeholder": string, "required": boolean }>
}

Rules:
- CRITICAL: Write "summary", "missingInfo", and ALL "questions" (including placeholders) strictly in ${targetLanguage}.
- Extract ALL languages, frameworks, libraries, databases, ORMs, test runners, linters, and infra tools you find in the files.
- Write a clear, accurate "summary" explaining what the project actually does based on the code and files.
- Only ask questions (0 to 4 max) for information that is genuinely NOT explicit in the code or in any existing README.md (e.g. target audience, business motivation, live demo URL if absent, or undocumented env vars). Do NOT ask about things already obvious in package.json, configs, source files, or an existing README.md.

Repository: ${scan.owner}/${scan.repo}
Description: ${scan.description || 'None'}
Homepage: ${scan.homepage || 'None'}
Topics: ${scan.topics.join(', ') || 'None'}
License: ${scan.license || 'None'}
Tree (sample):
${scan.tree.slice(0, 150).join('\n')}

Key Files & Source Entrypoints:
${scan.keyFiles.map((f) => `--- ${f.path} ---\n${f.content}`).join('\n\n')}
`;

    const parsed = await generateJsonWithGemini<Omit<AnalysisResult, 'mode'>>(key, prompt);
    return {
      mode: 'ai',
      projectName: parsed.projectName || baseline.projectName,
      summary: parsed.summary || baseline.summary,
      detectedLanguages: parsed.detectedLanguages?.length ? parsed.detectedLanguages : baseline.detectedLanguages,
      detectedFrameworks: parsed.detectedFrameworks?.length ? parsed.detectedFrameworks : baseline.detectedFrameworks,
      detectedTools: parsed.detectedTools?.length ? parsed.detectedTools : baseline.detectedTools,
      detectedScripts: parsed.detectedScripts || baseline.detectedScripts,
      detectedEnvVars: parsed.detectedEnvVars?.length ? parsed.detectedEnvVars : baseline.detectedEnvVars,
      missingInfo: parsed.missingInfo || [],
      questions: parsed.questions?.length ? parsed.questions : baseline.questions,
    };
  } catch (err) {
    console.warn('Gemini analysis failed, falling back to heuristic mode:', err);
    return baseline;
  }
}

export type FreePromptResult =
  | { kind: 'off_topic'; reply: string }
  | { kind: 'readme_request'; scan: RepoScanSummary; analysis: AnalysisResult };

/** Check whether a user input string is a GitHub URL or owner/repo slug. */
export function isGitHubRepoInput(input: string): boolean {
  const t = input.trim();
  if (!t || /\s/.test(t)) return false;
  if (/^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/i.test(t)) return true;
  if (/^github\.com\/[^/]+\/[^/]+/i.test(t)) return true;
  return /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(t);
}

/** Heuristic fallback for free-text prompt descriptions. */
export function heuristicAnalyzeFreePrompt(
  promptText: string,
  outputLang: 'pt-BR' | 'en' = 'pt-BR',
): FreePromptResult {
  const lower = promptText.toLowerCase();
  const isPt = outputLang === 'pt-BR';

  const readmeKeywords = [
    'readme',
    'projeto',
    'project',
    'app',
    'api',
    'site',
    'sistema',
    'bot',
    'cli',
    'saas',
    'next',
    'react',
    'node',
    'python',
    'typescript',
    'javascript',
    'docker',
    'prisma',
    'postgres',
    'markdown',
    '.md',
    'documentar',
    'documentação',
    'repositório',
    'github',
  ];

  const looksLikeProject = readmeKeywords.some((kw) => lower.includes(kw)) || promptText.length > 45;
  if (!looksLikeProject) {
    return {
      kind: 'off_topic',
      reply: isPt
        ? 'Sou um assistente focado em criar e melhorar arquivos README.md para projetos de software. Me conte o que seu projeto faz (ou cole um link do GitHub / anexe um .md) que eu monto tudo no Studio visual para você!'
        : 'I am an assistant focused on creating and improving README.md files for software projects. Describe what your project does (or paste a GitHub URL / attach a .md file) and I will build it in the visual Studio for you!',
    };
  }

  const langs: string[] = [];
  const frameworks: string[] = [];
  const tools: string[] = [];
  if (lower.includes('typescript') || lower.includes('ts')) langs.push('TypeScript');
  if (lower.includes('javascript') || lower.includes('js')) langs.push('JavaScript');
  if (lower.includes('python')) langs.push('Python');
  if (lower.includes('next')) frameworks.push('Next.js');
  if (lower.includes('react')) frameworks.push('React');
  if (lower.includes('tailwind')) frameworks.push('TailwindCSS');
  if (lower.includes('fastapi')) frameworks.push('FastAPI');
  if (lower.includes('docker')) tools.push('Docker');
  if (lower.includes('prisma')) tools.push('Prisma');
  if (lower.includes('postgres')) tools.push('PostgreSQL');

  const scan: RepoScanSummary = {
    owner: 'prompt',
    repo: 'meu-projeto',
    url: 'https://github.com/owner/repo',
    defaultBranch: 'main',
    description: promptText.trim(),
    homepage: null,
    license: 'MIT',
    topics: [],
    tree: ['README.md'],
    keyFiles: [{ path: 'PROMPT.txt', content: promptText.trim() }],
  };

  return {
    kind: 'readme_request',
    scan,
    analysis: {
      mode: 'heuristic',
      projectName: isPt ? 'Meu Projeto' : 'My Project',
      summary: promptText.trim(),
      detectedLanguages: langs,
      detectedFrameworks: frameworks,
      detectedTools: tools,
      detectedScripts: {},
      detectedEnvVars: [],
      missingInfo: [],
      questions: [
        {
          id: 'env_vars',
          question: isPt
            ? 'O projeto usa variáveis de ambiente (.env) ou algum comando específico para rodar?'
            : 'Does the project require any environment variables (.env) or specific run commands?',
          placeholder: 'Ex.: DATABASE_URL, API_KEY / pnpm dev',
        },
        {
          id: 'demo_url',
          question: isPt
            ? 'Tem algum link de demo, repositório ou nome específico para o título?'
            : 'Do you have a live demo link, repo URL, or specific project title?',
          placeholder: 'https://...',
        },
      ],
    },
  };
}

/** Analyze a free-text user prompt: classify intent, reply if off-topic, or prepare README generation. */
export async function analyzeFreePrompt(
  promptText: string,
  outputLang: 'pt-BR' | 'en' = 'pt-BR',
): Promise<FreePromptResult> {
  const key = process.env.GEMINI_API_KEY?.trim();
  const fallback = heuristicAnalyzeFreePrompt(promptText, outputLang);
  if (!key) return fallback;

  const targetLanguage = outputLang === 'en' ? 'English (en-US)' : 'Brazilian Portuguese (pt-BR)';

  try {
    const parsed = await generateJsonWithGemini<{
      intent: 'readme_request' | 'off_topic';
      offTopicReply?: string;
      projectName?: string;
      summary?: string;
      detectedLanguages?: string[];
      detectedFrameworks?: string[];
      detectedTools?: string[];
      detectedEnvVars?: string[];
      questions?: ClarificationQuestion[];
    }>(
      key,
      `
You are the AI assistant inside "Project README AI", a tool exclusively for generating and improving GitHub README.md files.
Evaluate the user's message below:
"${promptText.replace(/"/g, '\\"')}"

Return ONLY valid JSON:
- If the message is NOT about creating, describing, or documenting a software project / README.md (for example: general trivia, cooking recipes, jokes, random chat, unrelated homework):
  { "intent": "off_topic", "offTopicReply": "<polite, friendly 2-sentence reply in ${targetLanguage} explaining you specialize in creating README.md files and inviting them to describe their project, paste a GitHub link, or attach a .md file>" }
- If the message describes a software project, app, library, or asks for a README.md:
  {
    "intent": "readme_request",
    "projectName": string,
    "summary": string (in ${targetLanguage}),
    "detectedLanguages": string[],
    "detectedFrameworks": string[],
    "detectedTools": string[],
    "detectedEnvVars": string[],
    "questions": Array<{ "id": string, "question": string, "placeholder": string, "required": boolean }> (0 to 3 short questions in ${targetLanguage} only about missing details like repo name, env vars, or run commands)
  }
`,
    );

    if (parsed.intent === 'off_topic') {
      return {
        kind: 'off_topic',
        reply:
          parsed.offTopicReply ||
          (outputLang === 'en'
            ? 'I specialize in creating and improving README.md files. Describe your project, paste a GitHub URL, or attach a .md file to get started!'
            : 'Sou especialista em criar e melhorar arquivos README.md! Descreva seu projeto, cole um link do GitHub ou anexe um arquivo .md para começarmos.'),
      };
    }

    const projectName = parsed.projectName?.trim() || 'meu-projeto';
    const scan: RepoScanSummary = {
      owner: 'prompt',
      repo: projectName,
      url: 'https://github.com/owner/repo',
      defaultBranch: 'main',
      description: parsed.summary || promptText.trim(),
      homepage: null,
      license: 'MIT',
      topics: [],
      tree: ['README.md'],
      keyFiles: [{ path: 'PROMPT.txt', content: promptText.trim() }],
    };

    return {
      kind: 'readme_request',
      scan,
      analysis: {
        mode: 'ai',
        projectName,
        summary: parsed.summary || promptText.trim(),
        detectedLanguages: parsed.detectedLanguages || [],
        detectedFrameworks: parsed.detectedFrameworks || [],
        detectedTools: parsed.detectedTools || [],
        detectedScripts: {},
        detectedEnvVars: parsed.detectedEnvVars || [],
        missingInfo: [],
        questions: parsed.questions?.length ? parsed.questions : [],
      },
    };
  } catch (err) {
    console.warn('Gemini free-prompt analysis failed, falling back to heuristic:', err);
    return fallback;
  }
}
