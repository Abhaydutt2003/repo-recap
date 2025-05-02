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

  console.log(`Processing ${unprocessedCommits.length} unprocessed commits...`);

  // Process commits one at a time to avoid rate limits
  const processedCommits = [];

  for (const commit of unprocessedCommits) {
    console.log(`Processing commit: ${commit.commitHash.substring(0, 7)}`);

    try {
      // Process one commit at a time
      const summary = await summariseCommit(
        project.githubUrl,
        commit.commitHash,
      );

      // Save to database immediately
      const createdCommit = await db.commit.create({
        data: {
          projectId,
          commitHash: commit.commitHash,
          commitMessage: commit.commitMessage,
          commitAuthorName: commit.commitAuthorName,
          commitAuthorAvatar: commit.commitAuthorAvatar,
          commitDate: commit.commitDate,
          summary,
        },
      });

      processedCommits.push(createdCommit);

      // Optional: Add a small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100)); // 500ms delay
    } catch (error) {
      console.error(`Error processing commit ${commit.commitHash}:`, error);
      // Continue with other commits even if one fails
    }
  }

  return processedCommits;
};

// export const pollCommits = async (projectId: string) => {
//   const project = await fetchProject(projectId);
//   if (!project?.githubUrl) {
//     throw new Error("No github url present");
//   }
//   const commitHashes = await getCommitHashes(project.githubUrl);
//   const unprocessedCommits = await filterUnprocessedCommits(
//     projectId,
//     commitHashes,
//   );
//   const summaryResponses = await Promise.allSettled(
//     unprocessedCommits.map((commit) => {
//       return summariseCommit(project.githubUrl, commit.commitHash);
//     }),
//   );
//   const summaries = summaryResponses.map((response) => {
//     if (response.status === "fulfilled") {
//       return response.value;
//     }
//     return "";
//   });
//   const commits = await db.commit.createMany({
//     data: summaries.map((singleSummary, index) => {
//       return {
//         projectId,
//         commitHash: unprocessedCommits[index]!.commitHash,
//         commitMessage: unprocessedCommits[index]!.commitMessage,
//         commitAuthorName: unprocessedCommits[index]!.commitAuthorName,
//         commitAuthorAvatar: unprocessedCommits[index]!.commitAuthorAvatar,
//         commitDate: unprocessedCommits[index]!.commitDate,
//         summary: singleSummary,
//       };
//     }),
//   });
//   return commits;
// };

async function fetchProject(projectId: string) {
  return await db.project.findUnique({
    where: { id: projectId },
    select: {
      githubUrl: true,
    },
  });
}

//TODO add summarise commit with rate limit

async function summariseCommit(githubUrl: string, commitHash: string) {
  try {
    // Extract owner and repo from the GitHub URL
    const cleanUrl = githubUrl.replace(/\.git$/, "").replace(/\/$/, "");
    const urlParts = cleanUrl.split("/");
    const owner = urlParts[urlParts.length - 2];
    const repo = urlParts[urlParts.length - 1];
    
    const { data } = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: commitHash,
      mediaType: {
        format: "diff", // Request the diff format
      },
    });
    console.log(`Fetched diff for commit ${commitHash.substring(0, 7)}, processing...`);
        // Implement retry logic for the AI summary
        const MAX_RETRIES = 3;
        let retries = 0;
        let summary = "";
        
        // while (retries < MAX_RETRIES) {
        //   try {
        //     summary = await summariseCommitAi(data) || "";
        //     break; // Success - break the loop
        //   } catch (error) {
        //     retries++;
        //     console.error(`AI summary failed (attempt ${retries}/${MAX_RETRIES}):`, error);
            
        //     if (retries >= MAX_RETRIES) {
        //       return "Failed to generate summary after multiple attempts"; 
        //     }
            
        //     // Exponential backoff
        //     const delay = 1000 * Math.pow(2, retries);
        //     await new Promise(resolve => setTimeout(resolve, delay));
        //   }
        // }
        
        // return summary;
  } catch (error: any) {
    // Check for rate limit errors specifically
    if (
      error.status === 429 ||
      (error.response && error.response.status === 429)
    ) {
      console.error(`GitHub rate limit exceeded for commit ${commitHash}`);

      // Get rate limit info if available
      if (error.response && error.response.headers) {
        const resetTime = error.response.headers["x-ratelimit-reset"];
        const resetDate = resetTime
          ? new Date(parseInt(resetTime) * 1000)
          : new Date(Date.now() + 60 * 60 * 1000);
        const waitTime = Math.ceil((resetDate.getTime() - Date.now()) / 1000);

        console.log(
          `Rate limit will reset in ${waitTime} seconds (${resetDate.toLocaleTimeString()})`,
        );
      }

      // Wait for a minute before retrying
      await new Promise((resolve) => setTimeout(resolve, 60 * 1000));

      // Recursive retry after waiting
      return summariseCommit(githubUrl, commitHash);
    }

    console.error(`Error fetching diff for commit ${commitHash}:`, error);
    return "Error fetching commit details";
  }
}

// async function summariseCommit(githubUrl: string, commitHash: string) {
//   const { data } = await axios.get(`${githubUrl}/commit/${commitHash}.diff`, {
//     headers: {
//       Accept: "application/vnd.github.v3.diff",
//     },
//   });
//   return summariseCommitAi(data) || "";
// }

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
