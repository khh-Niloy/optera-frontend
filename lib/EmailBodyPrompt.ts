export const EmailBodyPrompt = (
  jobDescription: string,
  skills: string[],
  name: string,
  jobTitle: string
) => {
  return `
You are an expert job application email writer.

Using the following context:
- Applicant name: ${name}
- Skills: ${skills.join(", ")}
- Job title: ${jobTitle}
- Job description: ${jobDescription}

## TASK:
Write two sections: "introduction" and "fitInterestAndWillingnessToLearn".

## OUTPUT FORMAT:
Return a JSON object with this exact structure:

\`\`\`json
{
  "introduction": "",
  "fitInterestAndWillingnessToLearn": ""
}
\`\`\`

## INSTRUCTIONS:
- Write the **introduction** in 3–4 sentences.
  - Clearly state the applicant's name (${name}) and the role (${jobTitle}).
  - If the company name is not mentioned in the job description, **do not invent or use placeholders like [Company Name]**.
  - Keep the tone warm, confident, and professional.

- Write **fitInterestAndWillingnessToLearn** in 3–4 sentences.
  - Highlight genuine interest and readiness to learn.
  - Mention specific technologies, values, or missions **only if they appear in the job description**.
  - Never use placeholders like [Hiring Manager Name] or [Company Name].
  - Keep it authentic, concise, and professional.

Return **only** the JSON object — no explanations or extra text.
`;
};
