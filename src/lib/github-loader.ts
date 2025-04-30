import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";

export const loadGithubRepo = async (
  githubUrl: string,
  githubToken?: string,
) => {
  const [owner, repo] = githubUrl.replace("https://github.com/", "").split("/");
  // Fetch default branch using GitHub API
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers: githubToken ? { Authorization: `token ${githubToken}` } : {},
    },
  );
  const data = await response.json();
  const defaultBranch = data.default_branch;

  const loader = new GithubRepoLoader(githubUrl, {
    accessToken: githubToken || "",
    branch: defaultBranch,
    ignoreFiles: [
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      "bun.lockb",
    ],
    recursive: true,
    unknown: "warn",
    maxConcurrency: 5,
  });
  const docs = await loader.load();
  return docs;
};