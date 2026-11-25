'use client';

import { Check, Cpu, FolderSearch, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

type ScanProgressModalProps = {
  open: boolean;
  mode: 'github' | 'local' | 'prompt';
};

const STEPS_BY_MODE = {
  github: [
    { name: 'Lendo repositório no GitHub', meta: 'Árvore de arquivos e manifestos', duration: 2200, icon: FolderSearch },
    { name: 'Identificando linguagens e stack', meta: 'Frameworks, scripts e dependências', duration: 2600, icon: Cpu },
    { name: 'Analisando lacunas com AI', meta: 'Preparando perguntas objetivas', duration: 4500, icon: Sparkles },
  ],
  local: [
    { name: 'Lendo arquivo Markdown local', meta: 'Estrutura e seções existentes', duration: 1200, icon: FolderSearch },
    { name: 'Identificando stack mencionada', meta: 'Tecnologias e comandos', duration: 1800, icon: Cpu },
    { name: 'Analisando melhorias com AI', meta: 'Verificando o que falta no visual', duration: 3800, icon: Sparkles },
  ],
  prompt: [
    { name: 'Interpretando descrição do projeto', meta: 'Objetivo e contexto informados', duration: 1400, icon: FolderSearch },
    { name: 'Mapeando stack e ferramentas', meta: 'Catálogo de tecnologias e badges', duration: 2000, icon: Cpu },
    { name: 'Estruturando perguntas com AI', meta: 'Refinando detalhes do README.md', duration: 3800, icon: Sparkles },
  ],
};

const ease = (t: number) => 1 - Math.pow(1 - t, 2.2);

/**
 * Glass progress popup adapted from fx-progress:
 * each step fills smoothly with a soft #FF6D29 light and a 2px progress line.
 */
export function ScanProgressModal({ open, mode }: ScanProgressModalProps) {
  const steps = STEPS_BY_MODE[mode];
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open) {
      setActiveIndex(0);
      setProgress(0);
      return;
    }

    let raf = 0;
    let idx = 0;
    let start = performance.now();

    const tick = (now: number) => {
      const current = steps[idx];
      if (!current) return;

      const elapsed = now - start;
      const raw = Math.min(1, elapsed / current.duration);
      // On the last step, cap at 92% until the real API response finishes
      const capped = idx === steps.length - 1 ? Math.min(0.92, ease(raw)) : ease(raw);

      setActiveIndex(idx);
      setProgress(capped);

      if (raw >= 1 && idx < steps.length - 1) {
        idx += 1;
        start = now;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, steps]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Progresso da análise"
    >
      <article className="w-full max-w-[540px] rounded-3xl border border-white/15 bg-[#453027]/35 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
        <header className="mb-4 flex items-center justify-between px-2">
          <h3 className="text-sm font-medium text-white">Processando seu projeto</h3>
          <span className="text-xs tabular-nums text-[#BABABA]">
            {activeIndex} de {steps.length} concluídos
          </span>
        </header>

        <ul className="space-y-2">
          {steps.map((step, i) => {
            const IconComp = step.icon;
            const isDone = i < activeIndex;
            const isBusy = i === activeIndex;
            const pct = isDone ? 1 : isBusy ? progress : 0;

            return (
              <li
                key={step.name}
                className="relative grid h-14 grid-cols-[36px_minmax(0,1fr)_24px] items-center gap-3 overflow-hidden rounded-xl border border-white/10 bg-[#161316]/80 px-3"
              >
                {/* Soft travelling light fill clipped to progress (fx-progress) */}
                {isBusy && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-0"
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(255,109,41,0.12) 0%, rgba(255,109,41,0.28) 70%, rgba(255,176,136,0.35) 100%)',
                      clipPath: `inset(0 ${((1 - pct) * 100).toFixed(1)}% 0 0)`,
                    }}
                  />
                )}

                <span className="relative z-10 grid h-9 w-9 place-items-center rounded-lg bg-[#453027]/40 text-[#BABABA]">
                  <IconComp className="h-4 w-4 text-[#FF6D29]" />
                </span>

                <div className="relative z-10 min-w-0">
                  <p className="truncate text-xs font-medium text-white">{step.name}</p>
                  <p className="truncate text-[11px] text-[#BABABA]">{step.meta}</p>
                </div>

                {/* State indicator: done check / spinning ring / waiting */}
                <div className="relative z-10 flex justify-end">
                  {isDone ? (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-[#FF6D29] text-[#161316]">
                      <Check className="h-3 w-3 stroke-[2.5]" />
                    </span>
                  ) : isBusy ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-[#FF6D29]" />
                  ) : (
                    <span className="h-5 w-5 rounded-full border border-white/20" />
                  )}
                </div>

                {/* Exact 2px progress line */}
                {isBusy && (
                  <span
                    aria-hidden="true"
                    className="absolute right-3 bottom-0 left-3 z-20 h-[2px] origin-left rounded-full bg-[#FF6D29]"
                    style={{ transform: `scaleX(${pct})` }}
                  />
                )}

                <progress className="sr-only" max={100} value={Math.round(pct * 100)}>
                  {Math.round(pct * 100)}%
                </progress>
              </li>
            );
          })}
        </ul>
      </article>
    </div>
  );
}
