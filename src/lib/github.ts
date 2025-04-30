import { db } from "@/server/db";
import { Octokit } from "octokit";
import axios from "axios";
import { summariseCommit as summariseCommitAi } from "./gemini";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

type Response = {
  commitHash: string;
  commitMessage: string;
  commitAuthorName: string;
  commitAuthorAvatar: string;
  commitDate: string;
};

export const getCommitHashes = async (
  githubUrl: string,
): Promise<Response[]> => {
  // Clean up the URL and extract owner/repo
  const cleanUrl = githubUrl.replace(/\.git$/, "").replace(/\/$/, "");
  const urlParts = cleanUrl.split("/");
  const owner = urlParts[urlParts.length - 2];
  const repo = urlParts[urlParts.length - 1];

  if (!owner || !repo) {
    throw new Error(`Invalid GitHub URL: ${githubUrl}`);
  }

  try {
    const { data } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: 100, // Limit to 100 commits per request
    });

    if (!data || data.length === 0) {
      throw new Error(`No commits found for repository: ${owner}/${repo}`);
    }

    const sortedCommits = data.sort(
      (a, b) =>
        new Date(b.commit.author?.date || 0).getTime() -
        new Date(a.commit.author?.date || 0).getTime(),
    );

    return sortedCommits.map((commit) => ({
      commitHash: commit.sha,
      commitMessage: commit.commit.message,
      commitAuthorName: commit.commit.author?.name || "",
      commitAuthorAvatar: commit.author?.avatar_url || "",
      commitDate: commit.commit.author?.date || "",
    }));
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch commits: ${error.message}`);
    }
    throw new Error("Failed to fetch commits: Unknown error");
  }
};

export const pollCommits = async (projectId: string) => {
  const project = await fetchProject(projectId);
  if (!project?.githubUrl) {
    throw new Error("No github url present");
  }
  const commitHashes = await getCommitHashes(project.githubUrl);
  const unprocessedCommits = await filterUnprocessedCommits(
    projectId,
    commitHashes,
  );
  const summaryResponses = await Promise.allSettled(
    unprocessedCommits.map((commit) => {
      return summariseCommit(project.githubUrl, commit.commitHash);
    }),
  );
  console.log(summaryResponses);
  const summaries = summaryResponses.map((response) => {
    if (response.status === "fulfilled") {
      return response.value;
    }
    return "";
  });
  const commits = await db.commit.createMany({
    data: summaries.map((singleSummary, index) => {
      return {
        projectId,
        commitHash: unprocessedCommits[index]!.commitHash,
        commitMessage: unprocessedCommits[index]!.commitMessage,
        commitAuthorName: unprocessedCommits[index]!.commitAuthorName,
        commitAuthorAvatar: unprocessedCommits[index]!.commitAuthorAvatar,
        commitDate: unprocessedCommits[index]!.commitDate,
        summary: singleSummary,
      };
    }),
  });
  return commits;
};

async function fetchProject(projectId: string) {
  return await db.project.findUnique({
    where: { id: projectId },
    select: {
      githubUrl: true,
    },
  });
}

async function summariseCommit(githubUrl: string, commitHash: string) {
  const { data } = await axios.get(`${githubUrl}/commit/${commitHash}.diff`, {
    headers: {
      Accept: "application/vnd.github.v3.diff",
    },
  });
  return summariseCommitAi(data) || "";
}

async function filterUnprocessedCommits(
  projectId: string,
  commitHashes: Response[],
) {
  const processedCommits = await db.commit.findMany({
    where: { projectId },
  });
  const unprocessedCommits = commitHashes.filter(
    (singleCommit) =>
      !processedCommits.some(
        (singleProcessedCommit) =>
          singleProcessedCommit.commitHash === singleCommit.commitHash,
      ),
  );
  return unprocessedCommits;
}
