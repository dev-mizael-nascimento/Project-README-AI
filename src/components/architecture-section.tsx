'use client';

import { useEffect, useRef } from 'react';
import dg from '@/lib/diagram.js';

interface DiagramCardConfig {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  spec: Record<string, unknown>;
}

const DIAGRAMS: DiagramCardConfig[] = [
  {
    id: 'hub-sources',
    eyebrow: '01 · Entrada flexível',
    title: 'Qualquer ponto de partida',
    description:
      'Conecte um repositório do GitHub, envie um arquivo .md existente ou descreva seu projeto em linguagem natural.',
    spec: {
      layout: 'hub',
      alt: 'Fluxo de entrada conectando GitHub, arquivo .md, prompt livre, stack e estrutura ao motor de AI',
      center: { label: 'Project README AI', icon: 'ui:sparkles', tone: 'accent' },
      spokes: [
        { label: 'GitHub', icon: 'github' },
        { label: 'Arquivo .md', icon: 'ui:file-text' },
        { label: 'Prompt livre', icon: 'ui:pen-line' },
        { label: 'Next.js & React', icon: 'nextjs' },
        { label: 'TypeScript', icon: 'typescript' },
        { label: 'Docker', icon: 'docker' },
      ],
    },
  },
  {
    id: 'fanin-scan',
    eyebrow: '02 · Varredura inteligente',
    title: 'Leitura profunda da stack',
    description:
      'A AI inspeciona dependências, scripts, linguagens e configurações antes de formular qualquer pergunta.',
    spec: {
      layout: 'fanin',
      alt: 'Arquivos de projeto e frameworks convergindo para o analisador AI e gerando diagnóstico estruturado',
      sources: [
        { label: 'package.json', icon: 'json', sub: 'Scripts e deps' },
        { label: 'Python / API', icon: 'python', sub: 'Módulos e CLI' },
        { label: 'Tailwind CSS', icon: 'tailwindcss', sub: 'Estilos e UI' },
        { label: 'React', icon: 'react', sub: 'Componentes' },
      ],
      target: { label: 'Scanner AI', icon: 'ui:cpu', tone: 'accent' },
      then: [
        { label: 'Contexto extraído', icon: 'ui:layers', done: true },
        { label: 'Lacunas mapeadas', icon: 'ui:list-checks', done: true },
      ],
    },
  },
  {
    id: 'lanes-pipeline',
    eyebrow: '03 · Perguntas cirúrgicas',
    title: 'Só o que falta no código',
    description:
      'Em vez de questionários longos, o fluxo separa o que já está explícito do que precisa da sua decisão.',
    spec: {
      layout: 'lanes',
      curve: 'curve',
      alt: 'Entrada do projeto passando pelo núcleo AI em trilhas paralelas até o README final',
      input: { label: 'Contexto', icon: 'ui:layout-grid' },
      core: { label: 'Núcleo AI', icon: 'ui:bot', tone: 'accent' },
      lanes: [
        [{ label: 'Stack detectada', sub: 'Automático', done: true }],
        [{ label: 'Perguntas-chave', sub: '2 a 4 itens', done: true }],
        [{ label: 'Tom e seções', sub: 'Personalizado', done: true }],
      ],
      output: { label: 'README.md', icon: 'ui:file-text', done: true },
    },
  },
  {
    id: 'timeline-studio',
    eyebrow: '04 · Estúdio interativo',
    title: 'Do rascunho à publicação',
    description:
      'Acompanhe o progresso em tempo real, refine seções no estúdio e exporte o Markdown pronto para o repositório.',
    spec: {
      layout: 'timeline',
      alt: 'Linha do tempo em quatro etapas: leitura, perguntas, geração e exportação do README.md',
      steps: [
        { label: 'Leitura', sub: 'Repo ou prompt', icon: 'github' },
        { label: 'Refinamento', sub: 'Perguntas breves', icon: 'ui:list-checks' },
        { label: 'Geração AI', sub: 'Markdown limpo', icon: 'ui:sparkles' },
        { label: 'Exportar .md', sub: 'Pronto pro Git', icon: 'ui:file-text' },
      ],
    },
  },
];

function FreeDiagram({ item }: { item: DiagramCardConfig }) {
  const dgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = dgRef.current;
    if (!el) return;
    const instance = dg.mount(el, item.spec, { iconBase: '/icons/', controls: false });
    return () => {
      instance?.destroy?.();
    };
  }, [item]);

  return (
    <div
      className="flex flex-col"
      style={
        {
          '--ink': '#FFFFFF',
          '--muted': '#BABABA',
          '--accent': '#FF6D29',
          '--accent-ink': '#161316',
          '--card': '#110e11',
          '--bg': '#110e11',
          '--frag': '#231c20',
          '--r-sm': '8px',
        } as React.CSSProperties
      }
    >
      <div className="mb-3 space-y-1.5 px-1">
        <span className="inline-block font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#FF6D29]">
          {item.eyebrow}
        </span>
        <h3 className="text-xl font-semibold tracking-tight text-white">{item.title}</h3>
        <p className="max-w-xl text-sm leading-relaxed text-[#BABABA]">{item.description}</p>
      </div>

      <div
        className="panel relative w-full"
        style={{ '--p-h': '300px' } as React.CSSProperties}
      >
        <div ref={dgRef} className="dg" />
      </div>
    </div>
  );
}

export function ArchitectureSection() {
  return (
    <section
      aria-labelledby="architecture-heading"
      className="relative w-full"
    >
      {/* Transição suave entre o fundo WebGL/Grid da Seção 1 e a superfície calma da Seção 2 */}
      <div
        aria-hidden="true"
        className="pointer-events-none h-28 w-full bg-gradient-to-b from-transparent via-[#110e11]/80 to-[#110e11]"
      />

      <div className="relative bg-[#110e11] pb-24 pt-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-[#FF6D29]/[0.05] blur-3xl"
        />

        <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2
              id="architecture-heading"
              className="text-3xl font-semibold tracking-tight text-white sm:text-4xl"
            >
              Da análise do código ao README ideal, em quatro etapas visuais
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[#BABABA]">
              Cada etapa foi desenhada para eliminar atrito: você fornece o contexto, a AI extrai o
              que já existe e conduz apenas as decisões que importam.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-x-12 gap-y-14 lg:grid-cols-2">
            {DIAGRAMS.map((item) => (
              <FreeDiagram key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
