/** Check whether a user input string is a GitHub URL or owner/repo slug. */
export function isGitHubRepoInput(input: string): boolean {
  const t = input.trim();
  if (!t || /\s/.test(t)) return false;
  if (/^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/i.test(t)) return true;
  if (/^github\.com\/[^/]+\/[^/]+/i.test(t)) return true;
  return /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(t);
}
