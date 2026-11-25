import type { Metadata } from 'next';
import './globals.css';
import './diagrams.css';

export const metadata: Metadata = {
  title: 'Project README AI — Gerador Inteligente de README.md',
  description:
    'Analise qualquer repositório GitHub com IA, responda apenas ao que não está explícito no código e gere um README.md profissional.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
