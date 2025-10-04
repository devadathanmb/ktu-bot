// LLM providers APIs
// All LLM provider stuff should live here
const GROQ_BASE_URI = "https://api.groq.com/openai/v1";

export const GROQ_API = {
  BASE_URI: GROQ_BASE_URI,
  COMPLETION_ENDPOINT: `${GROQ_BASE_URI}/chat/completions`,
} as const;
