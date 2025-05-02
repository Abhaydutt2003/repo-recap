import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import axios from "axios";
import { Document } from "@langchain/core/documents";
import { generateEmbedding, summariseCode } from "./gemini";
import { db } from "@/server/db";

export const loadGithubRepo = async (
  githubUrl: string,
  githubToken?: string,
) => {
  const [owner, repo] = githubUrl.replace("https://github.com/", "").split("/");
  // Fetch default branch using GitHub API
  //TODO check if we can use ocktokit to fetch the github repo
  const { data } = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers: githubToken ? { Authorization: `token ${githubToken}` } : {},
    },
  );
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

export const indexGithubRepo = async (
  projectId: string,
  githubUrl: string,
  githubToken?: string,
) => {
  const docs = await loadGithubRepo(githubUrl);
  const allEmbeddings = await generateEmbeddings(docs);
  await Promise.allSettled(
    allEmbeddings.map(async (singleEmbedding, index) => {
      // console.log(`processing ${index} of ${allEmbeddings}`);
      if (!singleEmbedding) return;
      const sourceCodeEmbedding = await db.sourceCodeEmbedding.create({
        data: {
          summary: singleEmbedding.summary,
          sourceCode: singleEmbedding.sourceCode,
          fileName: singleEmbedding.fileName,
          projectId,
        },
      });
      //prisma does not support insertion of vectors, need to run raw sql query here.
      await db.$executeRaw`
    UPDATE "SourceCodeEmbedding"
    SET "summaryEmbedding" = ${singleEmbedding.embedding}::vector
    where "id" == ${sourceCodeEmbedding.id}
    `;
    }),
  );
};

const generateEmbeddings = async (docs: Document[]) => {
  return await Promise.all(
    docs.map(async (singleDoc) => {
      const summary = await summariseCode(singleDoc);
      const embedding = await generateEmbedding(summary);
      return {
        summary,
        embedding,
        sourceCode: JSON.parse(JSON.stringify(singleDoc.pageContent)),
        fileName: singleDoc.metadata.source,
      };
    }),
  );
};
