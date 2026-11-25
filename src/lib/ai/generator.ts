import { generateJsonWithGemini } from '@/lib/ai/client';
import { buildTechBadgesMarkdown } from '@/lib/badges';
import type { AnalysisResult, GenerateResult, ReadmeSection, RepoScanSummary } from '@/types/readme';

function buildHeuristicSections(
  scan: RepoScanSummary,
  analysis: AnalysisResult,
  answers: Record<string, string>,
  outputLang: 'pt-BR' | 'en',
  badgesMarkdown: string,
): ReadmeSection[] {
  const isPt = outputLang === 'pt-BR';
  const goal = answers.goal?.trim() || analysis.summary;
  const demoUrl = answers.demo_url?.trim() || scan.homepage;
  const extraFeatures = answers.extra_features?.trim();
  const envAnswer = answers.env_vars?.trim();

  const allTechs = [
    ...analysis.detectedLanguages,
    ...analysis.detectedFrameworks,
    ...analysis.detectedTools,
  ];

  const installCmd = analysis.detectedTools.includes('pnpm')
    ? 'pnpm install'
    : scan.keyFiles.some((f) => f.path === 'package.json')
      ? 'npm install'
      : scan.keyFiles.some((f) => f.path === 'requirements.txt')
        ? 'pip install -r requirements.txt'
        : '# Configure dependencies for your stack';

  const runCmd = analysis.detectedScripts.dev
    ? `${analysis.detectedTools.includes('pnpm') ? 'pnpm' : 'npm run'} dev`
    : analysis.detectedScripts.start
      ? `${analysis.detectedTools.includes('pnpm') ? 'pnpm' : 'npm run'} start`
      : '# Start the application';

  const sections: ReadmeSection[] = [
    {
      id: 'header',
      title: isPt ? 'Cabeçalho & Badges' : 'Header & Badges',
      enabled: true,
      markdown: `# ${analysis.projectName}\n\n${badgesMarkdown ? `${badgesMarkdown}\n\n` : ''}${goal}${demoUrl ? `\n\n🔗 **Demo:** [${demoUrl}](${demoUrl})` : ''}`,
    },
    {
      id: 'features',
      title: isPt ? 'Funcionalidades' : 'Features',
      enabled: Boolean(extraFeatures),
      markdown: `## ${isPt ? 'Funcionalidades' : 'Features'}\n\n${
        extraFeatures
          ? extraFeatures
              .split(/[,;\n]+/)
              .map((s) => s.trim())
              .filter(Boolean)
              .map((s) => `- ${s}`)
              .join('\n')
          : isPt
            ? '- Estrutura modular e pronta para produção'
            : '- Modular and production-ready architecture'
      }`,
    },
    {
      id: 'stack',
      title: isPt ? 'Tecnologias' : 'Tech Stack',
      enabled: allTechs.length > 0,
      markdown: `## ${isPt ? 'Tecnologias' : 'Tech Stack'}\n\n${allTechs.map((t) => `- **${t}**`).join('\n')}`,
    },
    {
      id: 'installation',
      title: isPt ? 'Instalação & Execução' : 'Installation & Usage',
      enabled: true,
      markdown: `## ${isPt ? 'Como rodar localmente' : 'Getting Started'}\n\n\`\`\`bash\n# ${isPt ? 'Clone o repositório' : 'Clone the repository'}\ngit clone ${scan.url}.git\ncd ${scan.repo}\n\n# ${isPt ? 'Instale as dependências' : 'Install dependencies'}\n${installCmd}\n\n# ${isPt ? 'Inicie o projeto' : 'Start the project'}\n${runCmd}\n\`\`\``,
    },
  ];

  const envList =
    analysis.detectedEnvVars.length > 0
      ? analysis.detectedEnvVars.map((v) => `- \`${v}\``).join('\n')
      : envAnswer
        ? envAnswer
            .split(/[,;\n]+/)
            .map((v) => v.trim())
            .filter(Boolean)
            .map((v) => `- \`${v}\``)
            .join('\n')
        : '';

  if (envList) {
    sections.push({
      id: 'env',
      title: isPt ? 'Variáveis de Ambiente' : 'Environment Variables',
      enabled: true,
      markdown: `## ${isPt ? 'Variáveis de Ambiente' : 'Environment Variables'}\n\n${isPt ? 'Crie um arquivo `.env` na raiz do projeto com:' : 'Create a `.env` file in the root directory:'}\n\n${envList}`,
    });
  }

  const scriptEntries = Object.entries(analysis.detectedScripts);
  if (scriptEntries.length > 0) {
    sections.push({
      id: 'scripts',
      title: isPt ? 'Scripts Disponíveis' : 'Available Scripts',
      enabled: true,
      markdown: `## ${isPt ? 'Scripts Disponíveis' : 'Available Scripts'}\n\n| Script | ${isPt ? 'Comando' : 'Command'} |\n| --- | --- |\n${scriptEntries.map(([k, v]) => `| \`${k}\` | \`${v}\` |`).join('\n')}`,
    });
  }

  sections.push({
    id: 'license',
    title: isPt ? 'Licença' : 'License',
    enabled: Boolean(scan.license),
    markdown: `## ${isPt ? 'Licença' : 'License'}\n\n${scan.license ? `${isPt ? 'Distribuído sob a licença' : 'Distributed under the'} **${scan.license}** ${isPt ? '' : 'license'}.` : isPt ? 'Defina a licença do projeto aqui.' : 'Specify your project license here.'}`,
  });

  return sections;
}

/** Generate structured README sections using Gemini AI (with heuristic fallback). */
export async function generateReadme(
  scan: RepoScanSummary,
  analysis: AnalysisResult,
  answers: Record<string, string>,
  outputLang: 'pt-BR' | 'en' = 'pt-BR',
  apiKey?: string,
): Promise<GenerateResult> {
  const allTechs = [
    ...analysis.detectedLanguages,
    ...analysis.detectedFrameworks,
    ...analysis.detectedTools,
  ];
  const badgesMarkdown = buildTechBadgesMarkdown(allTechs);
  const heuristicSections = buildHeuristicSections(scan, analysis, answers, outputLang, badgesMarkdown);

  const key = apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return {
      mode: 'heuristic',
      badgesMarkdown,
      sections: heuristicSections,
    };
  }

  const targetLanguage = outputLang === 'en' ? 'English (en-US)' : 'Brazilian Portuguese (pt-BR)';

  try {
    const existingReadme = scan.keyFiles.find(
      (f) => f.path.toLowerCase() === 'readme.md',
    )?.content;

    const prompt = `
You are a senior developer advocate and technical writer creating a visually stunning, GitHub-ready README.md.
Based ONLY on the repository scan, analysis, existing README (if any), and user's answers below, return a JSON object:
{
  "sections": Array<{ "id": string, "title": string, "markdown": string, "enabled": boolean }>
}

Rules:
- CRITICAL: Write ALL section titles, headings, prose, table headers, and code comments strictly in ${targetLanguage}. Even if the analysis, existing README, or user answers are in another language, translate and output everything in ${targetLanguage}.
- ${
      existingReadme
        ? 'An existing README.md was found! Preserve its accurate information, links, media, and intent, while upgrading its visual presentation (clean headings, inline tech badges from badgesMarkdown, structured tables for scripts/env vars, and adding any missing sections detected from the code or user answers).'
        : 'No existing README.md was found. Create a complete, visually polished README from scratch.'
    }
- Make the visual layout clean and professional (like top open-source GitHub repositories):
  1. "header": Clean title (\`# ...\`), concise tagline, the provided \`badgesMarkdown\` on one line, and demo/repo links if available.
  2. "features": \`## ✨ ...\` bullet list of concrete capabilities found in the code + user answers.
  3. "tech_stack": \`## 🛠️ ...\` clean summary or table of the detected stack.
  4. "structure": \`## 📁 ...\` compact ASCII folder tree highlighting the main directories from \`scan.tree\`.
  5. "getting_started": \`## 🚀 ...\` prerequisites + exact clone, install, and run commands using the detected package manager and scripts.
  6. "env_vars" (only if env vars exist): \`## 🔐 ...\` Markdown table with Variable, Description, Required.
  7. "scripts" (only if scripts exist): \`## 📜 ...\` Markdown table of available scripts.
  8. "license": \`## 📄 ...\` license info if detected.
- Do NOT invent commands, features, or environment variables that are not in the scan, existing README, or user answers.

Repository: ${scan.url} (license: ${scan.license || 'unspecified'})
Badges: ${badgesMarkdown}
Tree sample: ${scan.tree.slice(0, 60).join(', ')}
Analysis: ${JSON.stringify(analysis)}
User Answers: ${JSON.stringify(answers)}
${existingReadme ? `\nExisting README.md (excerpt):\n${existingReadme}` : ''}
`;

    const parsed = await generateJsonWithGemini<{ sections?: ReadmeSection[] }>(key, prompt);
    if (!parsed.sections?.length) {
      return { mode: 'heuristic', badgesMarkdown, sections: heuristicSections };
    }

    return {
      mode: 'ai',
      badgesMarkdown,
      sections: parsed.sections,
    };
  } catch (err) {
    console.warn('Gemini generation failed, falling back to heuristic mode:', err);
    return {
      mode: 'heuristic',
      badgesMarkdown,
      sections: heuristicSections,
    };
  }
}
