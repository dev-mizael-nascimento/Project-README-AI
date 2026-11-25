const BADGE_MAP: Record<string, { label: string; color: string; logo: string; logoColor?: string }> = {
  typescript: { label: 'TypeScript', color: '3178C6', logo: 'typescript', logoColor: 'white' },
  javascript: { label: 'JavaScript', color: 'F7DF1E', logo: 'javascript', logoColor: 'black' },
  python: { label: 'Python', color: '3776AB', logo: 'python', logoColor: 'white' },
  go: { label: 'Go', color: '00ADD8', logo: 'go', logoColor: 'white' },
  rust: { label: 'Rust', color: '000000', logo: 'rust', logoColor: 'white' },
  php: { label: 'PHP', color: '777BB4', logo: 'php', logoColor: 'white' },
  java: { label: 'Java', color: 'ED8B00', logo: 'openjdk', logoColor: 'white' },
  nextjs: { label: 'Next.js', color: '000000', logo: 'nextdotjs', logoColor: 'white' },
  'next.js': { label: 'Next.js', color: '000000', logo: 'nextdotjs', logoColor: 'white' },
  react: { label: 'React', color: '61DAFB', logo: 'react', logoColor: 'black' },
  vue: { label: 'Vue.js', color: '4FC08D', logo: 'vuedotjs', logoColor: 'white' },
  svelte: { label: 'Svelte', color: 'FF3E00', logo: 'svelte', logoColor: 'white' },
  angular: { label: 'Angular', color: 'DD0031', logo: 'angular', logoColor: 'white' },
  tailwindcss: { label: 'Tailwind_CSS', color: '06B6D4', logo: 'tailwindcss', logoColor: 'white' },
  tailwind: { label: 'Tailwind_CSS', color: '06B6D4', logo: 'tailwindcss', logoColor: 'white' },
  nodejs: { label: 'Node.js', color: '339933', logo: 'nodedotjs', logoColor: 'white' },
  'node.js': { label: 'Node.js', color: '339933', logo: 'nodedotjs', logoColor: 'white' },
  express: { label: 'Express', color: '000000', logo: 'express', logoColor: 'white' },
  fastify: { label: 'Fastify', color: '000000', logo: 'fastify', logoColor: 'white' },
  fastapi: { label: 'FastAPI', color: '009688', logo: 'fastapi', logoColor: 'white' },
  django: { label: 'Django', color: '092E20', logo: 'django', logoColor: 'white' },
  flask: { label: 'Flask', color: '000000', logo: 'flask', logoColor: 'white' },
  prisma: { label: 'Prisma', color: '2D3748', logo: 'prisma', logoColor: 'white' },
  drizzle: { label: 'Drizzle_ORM', color: 'C5F74F', logo: 'drizzle', logoColor: 'black' },
  postgresql: { label: 'PostgreSQL', color: '4169E1', logo: 'postgresql', logoColor: 'white' },
  mongodb: { label: 'MongoDB', color: '47A248', logo: 'mongodb', logoColor: 'white' },
  redis: { label: 'Redis', color: 'FF4438', logo: 'redis', logoColor: 'white' },
  docker: { label: 'Docker', color: '2496ED', logo: 'docker', logoColor: 'white' },
  vitest: { label: 'Vitest', color: '6E9F18', logo: 'vitest', logoColor: 'white' },
  playwright: { label: 'Playwright', color: '2EAD33', logo: 'playwright', logoColor: 'white' },
  jest: { label: 'Jest', color: 'C21325', logo: 'jest', logoColor: 'white' },
  pnpm: { label: 'pnpm', color: 'F69220', logo: 'pnpm', logoColor: 'black' },
  bun: { label: 'Bun', color: '000000', logo: 'bun', logoColor: 'white' },
  gemini: { label: 'Gemini_AI', color: '8E75B2', logo: 'googlegemini', logoColor: 'white' },
};

/** Build Shields.io badge markdown for detected technologies. */
export function buildTechBadgesMarkdown(techs: string[]): string {
  const seen = new Set<string>();
  const badges: string[] = [];

  for (const raw of techs) {
    const key = raw.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);

    const mapped = BADGE_MAP[key];
    if (mapped) {
      const logoColor = mapped.logoColor || 'white';
      badges.push(
        `![${raw}](https://img.shields.io/badge/${mapped.label}-${mapped.color}?style=for-the-badge&logo=${mapped.logo}&logoColor=${logoColor})`,
      );
    } else {
      const safeLabel = encodeURIComponent(raw.replace(/-/g, ' '));
      badges.push(`![${raw}](https://img.shields.io/badge/${safeLabel}-27272A?style=for-the-badge)`);
    }
  }

  return badges.join(' ');
}
