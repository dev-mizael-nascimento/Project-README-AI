import type { Icon, IconProviders } from '@/types/icon';

export type ClarificationQuestion = {
  id: string;
  question: string;
  placeholder: string;
  required?: boolean;
};

export type RepoScanSummary = {
  owner: string;
  repo: string;
  url: string;
  defaultBranch: string;
  description: string | null;
  homepage: string | null;
  license: string | null;
  topics: string[];
  logoUrl?: string | null;
  languages?: Record<string, number>;
  tree: string[];
  keyFiles: Array<{ path: string; content: string }>;
};

export type AnalysisResult = {
  mode: 'ai' | 'heuristic';
  projectName: string;
  summary: string;
  detectedLanguages: string[];
  detectedFrameworks: string[];
  detectedTools: string[];
  detectedScripts: Record<string, string>;
  detectedEnvVars: string[];
  missingInfo: string[];
  questions: ClarificationQuestion[];
};

export type TechIconItem = {
  name: string;
  currentProvider: `${IconProviders}`;
  variantIndex: number;
  providers: Icon['providers'];
  available_providers: Icon['available_providers'];
};

export type TechSectionData = {
  heading: string;
  align: 'left' | 'center' | 'right';
  height: number;
  spacing: number;
  icons: TechIconItem[];
};

export type ReadmeSection = {
  id: string;
  title: string;
  markdown: string;
  enabled: boolean;
  kind?: 'markdown' | 'techs';
  techData?: TechSectionData;
};

export type GenerateResult = {
  mode: 'ai' | 'heuristic';
  badgesMarkdown: string;
  sections: ReadmeSection[];
};
