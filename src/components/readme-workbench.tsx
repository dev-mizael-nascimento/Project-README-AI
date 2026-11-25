'use client';

import {
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  FileText,
  Github,
  Loader2,
  RotateCcw,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import type { AnalysisResult, ReadmeSection, RepoScanSummary } from '@/types/readme';

type Step = 'input' | 'questions' | 'editor';

export function ReadmeWorkbench() {
  const [step, setStep] = useState<Step>('input');
  const [repoUrl, setRepoUrl] = useState('');
  const [outputLang, setOutputLang] = useState<'pt-BR' | 'en'>('pt-BR');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scan, setScan] = useState<RepoScanSummary | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [sections, setSections] = useState<ReadmeSection[]>([]);
  const [genMode, setGenMode] = useState<'ai' | 'heuristic'>('heuristic');
  const [previewTab, setPreviewTab] = useState<'preview' | 'raw'>('preview');
  const [copied, setCopied] = useState(false);

  const fullMarkdown = useMemo(() => {
    return sections
      .filter((s) => s.enabled)
      .map((s) => s.markdown.trim())
      .filter(Boolean)
      .join('\n\n');
  }, [sections]);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!repoUrl.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
          outputLang,
        }),
      });
      const data = (await res.json()) as {
        scan?: RepoScanSummary;
        analysis?: AnalysisResult;
        error?: string;
      };
      if (!res.ok || !data.scan || !data.analysis) {
        throw new Error(data.error || 'Falha ao escanear repositório.');
      }
      setScan(data.scan);
      setAnalysis(data.analysis);
      setAnswers({});
      setStep('questions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!scan || !analysis) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scan,
          analysis,
          answers,
          outputLang,
        }),
      });
      const data = (await res.json()) as {
        mode?: 'ai' | 'heuristic';
        sections?: ReadmeSection[];
        error?: string;
      };
      if (!res.ok || !data.sections) {
        throw new Error(data.error || 'Falha ao gerar README.md.');
      }
      setSections(data.sections);
      setGenMode(data.mode || 'heuristic');
      setStep('editor');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
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

  function resetAll() {
    setStep('input');
    setScan(null);
    setAnalysis(null);
    setSections([]);
    setAnswers({});
    setError(null);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-6">
      {/* Header */}
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">Project README AI</h1>
            <p className="text-sm text-zinc-400">
              Lê o código do repositório, pergunta só o que falta e gera seu README.md
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={outputLang}
            onChange={(e) => setOutputLang(e.target.value as 'pt-BR' | 'en')}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:border-sky-500 focus:outline-none"
          >
            <option value="pt-BR">Português (BR)</option>
            <option value="en">English</option>
          </select>

          {step !== 'input' && (
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-700 hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
              Novo projeto
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* STEP 1: INPUT */}
      {step === 'input' && (
        <section className="mx-auto mt-6 w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8">
          <div className="mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-400 ring-1 ring-sky-500/20">
              Passo 1 de 3
            </span>
            <h2 className="mt-3 text-2xl font-semibold text-zinc-100">
              Qual repositório você quer documentar?
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Cole a URL de um repositório público do GitHub. Vamos ler a estrutura, scripts e
              dependências automaticamente.
            </p>
          </div>

          <form onSubmit={handleScan} className="space-y-4">
            <div className="relative">
              <Github className="pointer-events-none absolute top-3.5 left-3.5 h-5 w-5 text-zinc-500" />
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo ou owner/repo"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-3 pr-4 pl-11 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span>Testar com:</span>
              {[
                'maurodesouza/profile-readme-generator',
                'fastapi/fastapi',
                'colinhacks/zod',
              ].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setRepoUrl(`https://github.com/${example}`)}
                  className="rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-zinc-300 hover:border-zinc-700 hover:text-white"
                >
                  {example}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || !repoUrl.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Escaneando repositório...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Analisar projeto
                </>
              )}
            </button>
          </form>
        </section>
      )}

      {/* STEP 2: ANALYSIS & QUESTIONS */}
      {step === 'questions' && scan && analysis && (
        <section className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Detectado no código
              </span>
              <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300">
                {analysis.mode === 'ai' ? 'Gemini AI' : 'Modo Heurístico'}
              </span>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-100">
                {scan.owner}/{scan.repo}
              </h3>
              <p className="mt-1 text-sm text-zinc-400">{analysis.summary}</p>
            </div>

            <div className="space-y-3 pt-2">
              <TagGroup label="Linguagens" items={analysis.detectedLanguages} color="sky" />
              <TagGroup label="Frameworks" items={analysis.detectedFrameworks} color="emerald" />
              <TagGroup label="Ferramentas" items={analysis.detectedTools} color="violet" />
              <TagGroup label="Env Vars" items={analysis.detectedEnvVars} color="amber" />
            </div>

            {Object.keys(analysis.detectedScripts).length > 0 && (
              <div className="pt-2">
                <p className="mb-1.5 text-xs font-medium text-zinc-400">Scripts encontrados</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(analysis.detectedScripts).map((script) => (
                    <code
                      key={script}
                      className="rounded bg-zinc-950 px-2 py-0.5 text-xs text-zinc-300 ring-1 ring-zinc-800"
                    >
                      {script}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={handleGenerate}
            className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 lg:col-span-3"
          >
            <div>
              <span className="inline-flex items-center rounded-full bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-400 ring-1 ring-sky-500/20">
                Passo 2 de 3
              </span>
              <h2 className="mt-2 text-xl font-semibold text-zinc-100">
                Complete o que não está explícito no código
              </h2>
              <p className="text-sm text-zinc-400">
                Responda apenas o que fizer sentido — você pode deixar em branco e editar depois.
              </p>
            </div>

            <div className="space-y-4">
              {analysis.questions.map((q) => (
                <div key={q.id}>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-200">
                    {q.question}
                  </label>
                  <textarea
                    rows={2}
                    value={answers[q.id] || ''}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [q.id]: e.target.value,
                      }))
                    }
                    placeholder={q.placeholder}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-sky-400 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando README.md...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Gerar README.md
                </>
              )}
            </button>
          </form>
        </section>
      )}

      {/* STEP 3: EDITOR & PREVIEW */}
      {step === 'editor' && (
        <section className="grid gap-6 lg:grid-cols-2">
          {/* Left: Sections Editor */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-100">
                Seções geradas ({genMode === 'ai' ? 'Gemini AI' : 'Modo Heurístico'})
              </h2>
              <button
                type="button"
                onClick={() => setStep('questions')}
                className="text-xs text-sky-400 hover:underline"
              >
                Voltar às perguntas
              </button>
            </div>

            <div className="space-y-3">
              {sections.map((section, idx) => (
                <div
                  key={section.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        onChange={(e) =>
                          setSections((prev) =>
                            prev.map((s, i) =>
                              i === idx ? { ...s, enabled: e.target.checked } : s,
                            ),
                          )
                        }
                        className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 accent-sky-500"
                      />
                      {section.title}
                    </label>
                  </div>

                  {section.enabled && (
                    <textarea
                      rows={5}
                      value={section.markdown}
                      onChange={(e) =>
                        setSections((prev) =>
                          prev.map((s, i) =>
                            i === idx ? { ...s, markdown: e.target.value } : s,
                          ),
                        )
                      }
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-200 focus:border-sky-500 focus:outline-none"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Live Preview & Export */}
          <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
              <div className="flex items-center gap-1 rounded-lg bg-zinc-950 p-1">
                <button
                  type="button"
                  onClick={() => setPreviewTab('preview')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium ${
                    previewTab === 'preview'
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('raw')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium ${
                    previewTab === 'raw'
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Code2 className="h-3.5 w-3.5" />
                  Markdown
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-700"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copiar
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-sky-400"
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar README.md
                </button>
              </div>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-6">
              {previewTab === 'preview' ? (
                <article className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {fullMarkdown}
                  </ReactMarkdown>
                </article>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-300">
                  {fullMarkdown}
                </pre>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function TagGroup({
  label,
  items,
  color,
}: {
  label: string;
  items: string[];
  color: 'sky' | 'emerald' | 'violet' | 'amber';
}) {
  if (items.length === 0) return null;
  const styles = {
    sky: 'bg-sky-500/10 text-sky-300 ring-sky-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20',
    violet: 'bg-violet-500/10 text-violet-300 ring-violet-500/20',
    amber: 'bg-amber-500/10 text-amber-300 ring-amber-500/20',
  }[color];

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-zinc-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${styles}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
