import { GoogleGenerativeAI } from "@google/generative-ai";

const genAi = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const model = genAi.getGenerativeModel({
  model: "gemini-1.5-flash",
});

export const summariseCommit = async (diff: string) => {
  const prompt = `
You are an AI assistant specialized in summarizing Git commit diffs. Your goal is to generate a concise commit summary, ideally 1-2 lines long, that accurately reflects the changes. Follow standard commit message conventions where appropriate (e.g., "Feat:", "Fix:", "Refactor:", "Docs:", "Style:", "Chore:", "Perf:").

**TASK:** Analyze the provided Git diff and generate a brief summary (1-2 lines).

**EXAMPLE 1 (Fix/Refactor):**

* **Input Diff:**
    \`\`\`diff
    diff --git a/src/calculator.js b/src/calculator.js
    index 123..456 100644
    --- a/src/calculator.js
    +++ b/src/calculator.js
    @@ -5,7 +5,7 @@
       if (typeof a !== 'number' || typeof b !== 'number') {
    -    throw new Error('Inputs must be numbers');
    +    throw new TypeError('Invalid input: Both arguments must be numeric.');
       }
       if (b === 0) {
         throw new Error('Division by zero is not allowed.');
    \`\`\`
* **Expected Output Summary:**
    \`\`\`
    Fix: Refine error type and message for non-numeric inputs in divide function.
    \`\`\`

**EXAMPLE 2 (Feature Addition):**

* **Input Diff:**
    \`\`\`diff
    diff --git a/src/utils/parser.js b/src/utils/parser.js
    index abc..def 100644
    --- a/src/utils/parser.js
    +++ b/src/utils/parser.js
    @@ -1,5 +1,5 @@
     // Parses a string potentially containing a number
    -function parseNumericValue(str) {
    +function parseNumericValue(str, strict = false) {
       const num = parseFloat(str);
       if (isNaN(num)) {
         return null; // Return null for non-numeric strings
    @@ -7,5 +7,8 @@
       if (String(num) !== str.trim()) {
         // If the parsed number string doesn't match original (ignoring whitespace)
         // e.g., "123xyz" parsed as 123
    -    return null;
    +    if (strict) {
    +        return null; // Strict mode requires exact match
    +    }
       }
       return num;
     }
    \`\`\`
* **Expected Output Summary:**
    \`\`\`
    Feat: Add optional 'strict' mode to parseNumericValue utility.
    Allows stricter validation of numeric strings.
    \`\`\`

---

**NOW, PLEASE SUMMARIZE THE FOLLOWING DIFF:**

* **Input Diff:**
    \`\`\`diff
    ${diff}
    \`\`\`

* **Output Summary:**
`;
  const response = await model.generateContent([prompt]);
  return response.response.text();
};
