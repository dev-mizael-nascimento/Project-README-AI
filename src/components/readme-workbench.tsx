'use client';

import {
  ArrowUp,
  ChevronRight,
  FileText,
  Loader2,
  MessageSquareWarning,
  Paperclip,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { ArchitectureSection } from '@/components/architecture-section';
import { EdgeGlowBox } from '@/components/edge-glow-box';
import { GridPulseBg } from '@/components/grid-pulse-bg';
import { ReadmeStudio } from '@/components/readme-studio';
import { ScanProgressModal } from '@/components/scan-progress-modal';
import { isGitHubRepoInput } from '@/lib/input-detector';
import { splitMarkdownIntoSections } from '@/lib/markdown-splitter';
import { buildTechItemsFromNames, serializeTechSection } from '@/lib/tech-serializer';
import type { AnalysisResult, ReadmeSection, RepoScanSummary, TechSectionData } from '@/types/readme';

type Step = 'input' | 'questions' | 'editor';

export function ReadmeWorkbench() {
  const [step, setStep] = useState<Step>('input');
  const [inputMode, setInputMode] = useState<'github' | 'local'>('github');
  const [repoUrl, setRepoUrl] = useState('');
  const [localMarkdown, setLocalMarkdown] = useState('');
  const [localFileName, setLocalFileName] = useState('');
  const [outputLang, setOutputLang] = useState<'pt-BR' | 'en'>('pt-BR');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offTopicReply, setOffTopicReply] = useState<string | null>(null);

  const [scan, setScan] = useState<RepoScanSummary | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [sections, setSections] = useState<ReadmeSection[]>([]);
  const [genMode, setGenMode] = useState<'ai' | 'heuristic' | 'manual'>('heuristic');
  const [glowPaused, setGlowPaused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (inputMode === 'github' && !repoUrl.trim()) return;
    if (inputMode === 'local' && !localMarkdown.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          inputMode === 'local'
            ? {
                localMarkdown,
                fileName: localFileName || 'README.md',
                outputLang,
              }
            : {
                repoUrl: repoUrl.trim(),
                outputLang,
              },
        ),
      });
      const data = (await res.json()) as {
        scan?: RepoScanSummary;
        analysis?: AnalysisResult;
        offTopicReply?: string;
        error?: string;
      };
      if (data.offTopicReply) {
        setOffTopicReply(data.offTopicReply);
        return;
      }
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

      const detectedTechs = [
        ...analysis.detectedLanguages,
        ...analysis.detectedFrameworks,
        ...analysis.detectedTools,
      ];
      const techItems = buildTechItemsFromNames(detectedTechs, 'devicons');
      const upgradedSections = data.sections.map((sec) => {
        if (
          techItems.length > 0 &&
          (sec.id === 'tech_stack' || sec.id === 'stack' || /tech|tecnologia/i.test(sec.title))
        ) {
          const techData: TechSectionData = {
            heading: outputLang === 'pt-BR' ? '## 🛠️ Tecnologias' : '## 🛠️ Tech Stack',
            align: 'left',
            height: 40,
            spacing: 12,
            icons: techItems,
          };
          return {
            ...sec,
            kind: 'techs' as const,
            techData,
            markdown: serializeTechSection(techData),
          };
        }
        return sec;
      });

      setSections(upgradedSections);
      setGenMode(data.mode || 'heuristic');
      setStep('editor');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenDirectInStudio() {
    if (!localMarkdown.trim()) return;
    const parsed = splitMarkdownIntoSections(localMarkdown);
    setSections(parsed);
    setGenMode('manual');
    setStep('editor');
  }

  function resetAll() {
    setStep('input');
    setScan(null);
    setAnalysis(null);
    setSections([]);
    setAnswers({});
    setError(null);
  }

  if (step === 'editor') {
    return (
      <ReadmeStudio
        sections={sections}
        onChangeSections={setSections}
        outputLang={outputLang}
        genMode={genMode}
        onBackToQuestions={genMode === 'manual' ? undefined : () => setStep('questions')}
        onReset={resetAll}
      />
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col text-white">
      <GridPulseBg bg="#161316" ink="#BABABA" accent="#FF6D29" />

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6">
        {/* Discreet floating language / reset controls (no top bar) */}
        <div className="mb-4 flex items-center justify-end gap-2">
          <select
            value={outputLang}
            onChange={(e) => setOutputLang(e.target.value as 'pt-BR' | 'en')}
            className="rounded-full border border-white/15 bg-[#161316]/60 px-3 py-1 text-xs text-[#BABABA] backdrop-blur-md focus:border-[#FF6D29] focus:text-white focus:outline-none"
          >
            <option value="pt-BR">PT-BR</option>
            <option value="en">EN</option>
          </select>

          {step !== 'input' && (
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#161316]/60 px-3 py-1 text-xs text-[#BABABA] backdrop-blur-md transition hover:border-white/30 hover:text-white"
            >
              <RotateCcw className="h-3 w-3" />
              Novo projeto
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm text-red-200 backdrop-blur-md">
            {error}
          </div>
        )}

        {/* STEP 1: FX-HEADLINE + FX-PROMPT */}
        {step === 'input' && (
          <section className="mx-auto my-auto flex w-full max-w-[980px] flex-col items-center py-4">
            {/* fx-headline */}
            <div className="mb-10 flex flex-col items-center gap-5 text-center">
              <a
                href="https://github.com/dev-mizael-nascimento/Project-README-AI"
                target="_blank"
                rel="noreferrer"
                className="group inline-flex h-8 items-center gap-2.5 rounded-full border border-white/15 bg-[#453027]/30 pr-3 pl-1 text-xs text-white backdrop-blur-xl transition hover:border-white/30 hover:bg-[#453027]/50"
              >
                <span className="inline-grid h-6 place-items-center rounded-full bg-[#FF6D29] px-2.5 text-[11px] font-semibold text-[#161316]">
                  Open Source
                </span>
                <span className="text-[#BABABA] group-hover:text-white">
                  Project README AI • Studio + AI
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-[#BABABA] transition-transform group-hover:translate-x-0.5" />
              </a>

              <h1 className="max-w-[15ch] text-[clamp(38px,5vw+10px,80px)] font-semibold leading-[1.02] tracking-[-0.035em] text-white">
                Documente seu código com{' '}
                <span className="bg-gradient-to-r from-[#FF6D29] via-[#ffb894] to-[#FF6D29] bg-clip-text text-transparent">
                  precisão visual
                </span>
              </h1>

              <p className="max-w-[46ch] text-base leading-relaxed text-[#BABABA]">
                A IA lê seu repositório, pergunta só o que não está explícito e entrega tudo
                pronto no Studio interativo.
              </p>
            </div>

            <form onSubmit={handleScan} className="w-full max-w-[600px] space-y-6">
              <EdgeGlowBox accent="#FF6D29" inset={18} radius={22} paused={glowPaused}>
                <div className="p-4">
                  {inputMode === 'local' && localFileName ? (
                    <div className="mb-2 flex items-center justify-between rounded-xl border border-white/10 bg-[#161316]/60 px-3 py-2 text-xs">
                      <span className="flex items-center gap-2 text-white">
                        <FileText className="h-4 w-4 text-[#FF6D29]" />
                        {localFileName} ({localMarkdown.length} chars)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleOpenDirectInStudio}
                          className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/25"
                        >
                          Abrir direto no Studio
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInputMode('github');
                            setLocalFileName('');
                            setLocalMarkdown('');
                          }}
                          className="text-[#BABABA] hover:text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <textarea
                    ref={inputRef}
                    rows={2}
                    value={repoUrl}
                    onChange={(e) => {
                      setInputMode('github');
                      setRepoUrl(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        e.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder="Cole um link do GitHub, descreva seu projeto ou anexe um .md..."
                    className="block min-h-[52px] w-full resize-none border-0 bg-transparent text-sm leading-relaxed text-white caret-[#FF6D29] placeholder:text-[#BABABA]/60 focus:outline-none"
                  />

                  <div className="mt-3 flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".md,.markdown,.txt"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const text = await file.text();
                        setLocalFileName(file.name);
                        setLocalMarkdown(text);
                        setInputMode('local');
                      }}
                    />
                    <button
                      type="button"
                      title="Anexar arquivo .md local"
                      onClick={() => fileInputRef.current?.click()}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 text-[#BABABA] transition hover:border-white/30 hover:text-white"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>

                    <span className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/15 px-3 text-xs text-white">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#FF6D29]" />
                      {inputMode === 'local'
                        ? 'Markdown Local'
                        : isGitHubRepoInput(repoUrl)
                          ? 'GitHub + AI'
                          : 'Prompt Livre + AI'}
                    </span>

                    <button
                      type="submit"
                      disabled={
                        loading ||
                        (inputMode === 'github' ? !repoUrl.trim() : !localMarkdown.trim())
                      }
                      title={inputMode === 'local' ? 'Melhorar com IA' : 'Analisar projeto'}
                      className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-[#FF6D29] text-[#161316] shadow-md shadow-[#FF6D29]/30 transition hover:bg-[#ff8147] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowUp className="h-4 w-4 stroke-[2.2]" />
                      )}
                    </button>
                  </div>
                </div>
              </EdgeGlowBox>

              {/* Pause/Resume edge-glow toggle */}
              <div className="flex justify-end px-2">
                <button
                  type="button"
                  onClick={() => setGlowPaused((v) => !v)}
                  title={glowPaused ? 'Retomar luz na borda' : 'Pausar luz na borda'}
                  className="grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-[#161316]/50 text-[#BABABA] transition hover:text-white"
                >
                  {glowPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* STEP 2: GLASS ANALYSIS & QUESTIONS */}
        {step === 'questions' && scan && analysis && (
          <section className="my-auto grid gap-6 lg:grid-cols-5">
            <div className="space-y-4 rounded-3xl border border-white/15 bg-[#453027]/25 p-6 backdrop-blur-2xl lg:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-[#BABABA]">
                  Detectado no código
                </span>
                <span className="rounded-full border border-[#FF6D29]/40 bg-[#FF6D29]/15 px-2.5 py-0.5 text-xs text-[#FF6D29]">
                  {analysis.mode === 'ai' ? 'AI' : 'Modo Heurístico'}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white">
                  {scan.owner}/{scan.repo}
                </h3>
                <p className="mt-1 text-sm text-[#BABABA]">{analysis.summary}</p>
              </div>

              <div className="space-y-3 pt-2">
                <TagGroup label="Linguagens" items={analysis.detectedLanguages} color="orange" />
                <TagGroup label="Frameworks" items={analysis.detectedFrameworks} color="emerald" />
                <TagGroup label="Ferramentas" items={analysis.detectedTools} color="silver" />
                <TagGroup label="Env Vars" items={analysis.detectedEnvVars} color="amber" />
              </div>

              {Object.keys(analysis.detectedScripts).length > 0 && (
                <div className="pt-2">
                  <p className="mb-1.5 text-xs font-medium text-[#BABABA]">Scripts encontrados</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(analysis.detectedScripts).map((script) => (
                      <code
                        key={script}
                        className="rounded-full border border-white/10 bg-[#161316]/70 px-2.5 py-0.5 text-xs text-white"
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
              className="space-y-5 rounded-3xl border border-white/15 bg-[#453027]/25 p-6 backdrop-blur-2xl lg:col-span-3"
            >
              <div>
                <span className="inline-flex items-center rounded-full border border-[#FF6D29]/40 bg-[#FF6D29]/15 px-3 py-1 text-xs font-medium text-[#FF6D29]">
                  Passo 2 de 3
                </span>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Complete o que não está explícito no código
                </h2>
                <p className="text-sm text-[#BABABA]">
                  Responda apenas o que fizer sentido — você pode deixar em branco e editar depois.
                </p>
              </div>

              <div className="space-y-4">
                {analysis.questions.map((q) => (
                  <div key={q.id}>
                    <label className="mb-1.5 block text-sm font-medium text-white">
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
                      className="w-full rounded-2xl border border-white/15 bg-[#161316]/70 px-4 py-2.5 text-sm text-white placeholder:text-[#BABABA]/50 focus:border-[#FF6D29] focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FF6D29] px-6 py-3 text-sm font-semibold text-[#161316] shadow-lg shadow-[#FF6D29]/20 transition hover:bg-[#ff8147] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando README.md...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Gerar e abrir no Studio
                  </>
                )}
              </button>
            </form>
          </section>
        )}
      </div>

      {step === 'input' && <ArchitectureSection />}

      {/* Glass Progress Popup after Step 1 */}
      <ScanProgressModal
        open={loading && step === 'input'}
        mode={
          inputMode === 'local'
            ? 'local'
            : isGitHubRepoInput(repoUrl)
              ? 'github'
              : 'prompt'
        }
      />

      {/* Glass Popup for Off-Topic AI Message */}
      {offTopicReply && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setOffTopicReply(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-white/15 bg-[#453027]/40 p-6 shadow-2xl backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#FF6D29]">
                <Sparkles className="h-4 w-4" />
                Assistente Project README AI
              </span>
              <button
                type="button"
                onClick={() => setOffTopicReply(null)}
                className="rounded-full p-1 text-[#BABABA] hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-5 flex gap-3">
              <MessageSquareWarning className="mt-0.5 h-5 w-5 shrink-0 text-[#FF6D29]" />
              <p className="text-sm leading-relaxed text-white">{offTopicReply}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setOffTopicReply(null);
                inputRef.current?.focus();
              }}
              className="w-full rounded-full bg-[#FF6D29] py-2.5 text-xs font-semibold text-[#161316] transition hover:bg-[#ff8147]"
            >
              Entendi, voltar ao prompt
            </button>
          </div>
        </div>
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
  color: 'orange' | 'emerald' | 'silver' | 'amber';
}) {
  if (items.length === 0) return null;
  const styles = {
    orange: 'border-[#FF6D29]/30 bg-[#FF6D29]/15 text-[#FF6D29]',
    emerald: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300',
    silver: 'border-white/15 bg-white/10 text-white',
    amber: 'border-amber-400/30 bg-amber-500/15 text-amber-200',
  }[color];

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-[#BABABA]">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
