#!/usr/bin/env node

const apiKey = process.env.OPENAI_API_KEY;
const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const requiredModels = [
  process.env.LLM_INTERPRETER_MODEL ?? process.env.LLM_REPORT_MODEL ?? "gpt-5.5-pro",
  process.env.LLM_WRITER_MODEL ?? "gpt-5.5-thinking",
].filter(Boolean);

if (!apiKey) {
  console.error(JSON.stringify({ ok: false, error: "OPENAI_API_KEY is required to confirm model availability." }, null, 2));
  process.exit(1);
}

const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
  headers: { Authorization: `Bearer ${apiKey}` },
});

if (!response.ok) {
  const body = await response.text();
  console.error(JSON.stringify({ ok: false, status: response.status, body: body.slice(0, 800) }, null, 2));
  process.exit(1);
}

const data = await response.json();
const availableIds = new Set((data.data ?? []).map((model) => model.id).filter(Boolean));
const missing = requiredModels.filter((model) => !availableIds.has(model));

console.log(
  JSON.stringify(
    {
      ok: missing.length === 0,
      requiredModels,
      missing,
      availableMatches: requiredModels.filter((model) => availableIds.has(model)),
    },
    null,
    2,
  ),
);

if (missing.length > 0) process.exit(1);
