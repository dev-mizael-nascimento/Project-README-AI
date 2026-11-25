import type { RepoScanSummary } from '@/types/readme';

const IGNORED_PREFIXES = [
  'node_modules/',
  '.git/',
  '.next/',
  'dist/',
  'build/',
  'out/',
  'coverage/',
  '__pycache__/',
  '.venv/',
  'venv/',
  'target/',
  'vendor/',
];

const HIGH_SIGNAL_EXACT = new Set([
  'package.json',
  'pyproject.toml',
  'requirements.txt',
  'Cargo.toml',
  'go.mod',
  'composer.json',
  'pom.xml',
  'build.gradle',
  'Gemfile',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.env.example',
  '.env.sample',
  'tsconfig.json',
  'biome.json',
  'README.md',
  'readme.md',
]);

const HIGH_SIGNAL_PREFIXES = [
  'next.config.',
  'vite.config.',
  'vitest.config.',
  'playwright.config.',
  'tailwind.config.',
  'drizzle.config.',
  'prisma/schema.prisma',
];

const MAX_KEY_FILES = 16;
const MAX_FILE_CHARS = 4000;
const MAX_TREE_PATHS = 250;

const SOURCE_ENTRY_PATTERNS = [
  /^src\/app\/.*page\.(tsx|jsx|ts|js)$/,
  /^src\/app\/api\/.*route\.(ts|js)$/,
  /^src\/(index|main|app|server)\.(ts|tsx|js|py|go|rs)$/,
  /^(index|main|app|server)\.(ts|js|py|go|rs)$/,
];

function isSourceEntryFile(filePath: string): boolean {
  return SOURCE_ENTRY_PATTERNS.some((re) => re.test(filePath));
}

/** Parse a GitHub repository URL or owner/repo string into { owner, repo }. */
export function parseGitHubUrl(input: string): { owner: string; repo: string } {
  const trimmed = input.trim().replace(/\.git$/, '').replace(/\/+$/, '');

  const shortMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error('Invalid GitHub repository URL. Use https://github.com/owner/repo');
  }

  if (!parsed.hostname.includes('github.com')) {
    throw new Error('Only github.com repositories are supported right now.');
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error('Invalid GitHub repository URL. Expected /owner/repo.');
  }

  return { owner: parts[0], repo: parts[1] };
}

function buildGitHubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'project-readme-ai',
  };
  const authToken = token || process.env.GITHUB_TOKEN;
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  return headers;
}

function isHighSignalFile(filePath: string): boolean {
  const base = filePath.split('/').pop() ?? filePath;
  if (HIGH_SIGNAL_EXACT.has(filePath) || HIGH_SIGNAL_EXACT.has(base)) {
    return true;
  }
  return HIGH_SIGNAL_PREFIXES.some((prefix) => filePath.startsWith(prefix) || base.startsWith(prefix));
}

/** Scan a public GitHub repository for metadata, file tree, and key manifest/config files. */
export async function scanGitHubRepo(
  repoUrl: string,
  githubToken?: string,
): Promise<RepoScanSummary> {
  const { owner, repo } = parseGitHubUrl(repoUrl);
  const headers = buildGitHubHeaders(githubToken);

  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!repoRes.ok) {
    if (repoRes.status === 404) {
      throw new Error(`Repository ${owner}/${repo} not found (or is private).`);
    }
    if (repoRes.status === 403) {
      throw new Error('GitHub API rate limit reached. Add GITHUB_TOKEN in .env to increase the limit.');
    }
    throw new Error(`GitHub API error (${repoRes.status}) while fetching repository.`);
  }

  const repoMeta = (await repoRes.json()) as {
    default_branch?: string;
    description?: string | null;
    homepage?: string | null;
    license?: { spdx_id?: string | null; name?: string | null } | null;
    topics?: string[];
  };

  const defaultBranch = repoMeta.default_branch || 'main';

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
    { headers },
  );

  let allPaths: string[] = [];
  if (treeRes.ok) {
    const treeData = (await treeRes.json()) as {
      tree?: Array<{ path?: string; type?: string }>;
    };
    allPaths = (treeData.tree || [])
      .filter((item) => item.type === 'blob' && item.path)
      .map((item) => item.path as string)
      .filter((p) => !IGNORED_PREFIXES.some((prefix) => p.startsWith(prefix)));
  }

  const configPaths = allPaths.filter(isHighSignalFile);
  const sourcePaths = allPaths.filter((p) => !isHighSignalFile(p) && isSourceEntryFile(p)).slice(0, 6);
  const signalPaths = [...configPaths, ...sourcePaths].slice(0, MAX_KEY_FILES);

  const keyFiles = await Promise.all(
    signalPaths.map(async (filePath) => {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${filePath}`;
      const res = await fetch(rawUrl, { headers });
      if (!res.ok) return null;
      const text = await res.text();
      return {
        path: filePath,
        content: text.slice(0, MAX_FILE_CHARS),
      };
    }),
  );

  return {
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`,
    defaultBranch,
    description: repoMeta.description ?? null,
    homepage: repoMeta.homepage || null,
    license: repoMeta.license?.spdx_id || repoMeta.license?.name || null,
    topics: repoMeta.topics || [],
    tree: allPaths.slice(0, MAX_TREE_PATHS),
    keyFiles: keyFiles.filter((f): f is { path: string; content: string } => f !== null),
  };
}
