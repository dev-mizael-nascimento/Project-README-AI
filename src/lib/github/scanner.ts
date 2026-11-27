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
  'Pipfile',
  'setup.py',
  'setup.cfg',
  'Cargo.toml',
  'go.mod',
  'composer.json',
  'pom.xml',
  'build.gradle',
  'Gemfile',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'Procfile',
  'Makefile',
  '.env.example',
  '.env.sample',
  '.env.template',
  '.env.dist',
  '.env.local.example',
  '.env.development.example',
  'tsconfig.json',
  'biome.json',
  'README.md',
  'readme.md',
]);

const HIGH_SIGNAL_PREFIXES = [
  '.env.',
  'next.config.',
  'vite.config.',
  'vitest.config.',
  'playwright.config.',
  'tailwind.config.',
  'drizzle.config.',
  'prisma/schema.prisma',
];

const MAX_KEY_FILES = 24;
const MAX_FILE_CHARS = 4000;
const MAX_TREE_PATHS = 400;

const SOURCE_ENTRY_PATTERNS = [
  /^src\/app\/.*page\.(tsx|jsx|ts|js)$/,
  /^src\/app\/api\/.*route\.(ts|js)$/,
  /^src\/(index|main|app|server)\.(ts|tsx|js|py|go|rs)$/,
  /^(index|main|app|server|manage|models|config)\.(ts|js|py|go|rs)$/,
  /^[^/]+\/(index|main|app|server|manage|models|config)\.(ts|tsx|js|jsx|py|go|rs)$/,
];

function hasIgnoredSegment(filePath: string): boolean {
  return IGNORED_PREFIXES.some(
    (prefix) => filePath.startsWith(prefix) || filePath.includes(`/${prefix}`),
  );
}

function encodeGitHubPath(filePath: string): string {
  return filePath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

const IMAGE_EXT_RE = /\.(png|svg|webp|jpe?g)$/i;

/** Pick the most likely repository logo image from the file tree and build its raw GitHub URL. */
export function detectRepoLogoUrl(
  allPaths: string[],
  owner: string,
  repo: string,
  defaultBranch: string,
): string | null {
  let bestPath: string | null = null;
  let bestScore = 0;

  for (const p of allPaths) {
    if (!IMAGE_EXT_RE.test(p)) continue;
    const lower = p.toLowerCase();
    const base = lower.split('/').pop() ?? lower;

    // Skip generic tiny icons or screenshots/previews
    if (/preview|screenshot|banner|favicon|og-image|cover/.test(base)) continue;

    let score = 0;
    if (/logo|logotipo/.test(base)) score += 10;
    else if (/logo|logotipo/.test(lower)) score += 6;
    if (/brand|identidade/.test(lower)) score += 4;
    if (/^icon\.(png|svg|webp)$/.test(base)) score += 3;

    if (score === 0) continue;
    if (lower.endsWith('.svg')) score += 2;
    else if (lower.endsWith('.png')) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestPath = p;
    }
  }

  return bestPath
    ? `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${encodeGitHubPath(bestPath)}`
    : null;
}

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

  const [treeRes, languagesRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, {
      headers,
    }),
    fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, { headers }),
  ]);

  let allPaths: string[] = [];
  if (treeRes.ok) {
    const treeData = (await treeRes.json()) as {
      tree?: Array<{ path?: string; type?: string }>;
    };
    allPaths = (treeData.tree || [])
      .filter((item) => item.type === 'blob' && item.path)
      .map((item) => item.path as string)
      .filter((p) => !hasIgnoredSegment(p));
  }

  let languages: Record<string, number> | undefined;
  if (languagesRes.ok) {
    try {
      languages = (await languagesRes.json()) as Record<string, number>;
    } catch {
      languages = undefined;
    }
  }

  const configPaths = allPaths.filter(isHighSignalFile).sort((a, b) => {
    const aBase = a.split('/').pop() ?? a;
    const bBase = b.split('/').pop() ?? b;
    const aPriority = aBase.startsWith('.env') ? 0 : 1;
    const bPriority = bBase.startsWith('.env') ? 0 : 1;
    return aPriority - bPriority;
  });
  const sourcePaths = allPaths.filter((p) => !isHighSignalFile(p) && isSourceEntryFile(p)).slice(0, 8);
  const signalPaths = [...configPaths, ...sourcePaths].slice(0, MAX_KEY_FILES);

  const keyFiles = await Promise.all(
    signalPaths.map(async (filePath) => {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${encodeGitHubPath(filePath)}`;
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
    logoUrl: detectRepoLogoUrl(allPaths, owner, repo, defaultBranch),
    languages,
    tree: allPaths.slice(0, MAX_TREE_PATHS),
    keyFiles: keyFiles.filter((f): f is { path: string; content: string } => f !== null),
  };
}
