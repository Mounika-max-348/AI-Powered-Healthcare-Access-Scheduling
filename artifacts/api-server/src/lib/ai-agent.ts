import Groq from "groq-sdk";
import { logger } from "./logger";

const MODEL = process.env["GROQ_MODEL"] || "llama-3.3-70b-versatile";

let client: Groq | null = null;
function getClient(): Groq | null {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) return null;
  if (!client) client = new Groq({ apiKey });
  return client;
}

export type ConversationTurn = { role: "user" | "assistant"; text: string };

export type ClassifiedIntent = {
  reply: string;
  intent: "FIND_APPOINTMENT" | "BOOK_APPOINTMENT" | "CLARIFICATION" | "SAFETY_REDIRECT";
  stage: "SAFE_REDIRECT" | "CLARIFICATION" | "DISCOVERY" | "READY_TO_BOOK";
  requestedSpecialty: string | null;
};

const CLASSIFY_TOOL: Groq.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "classify_patient_request",
    description:
      "Record the structured administrative classification of the patient's message. Always call this tool exactly once.",
    parameters: {
      type: "object",
      properties: {
        reply: {
          type: "string",
          description:
            "A short, warm, administrative reply to show the patient. Never includes diagnosis, treatment, or medication guidance.",
        },
        intent: {
          type: "string",
          enum: ["FIND_APPOINTMENT", "BOOK_APPOINTMENT", "CLARIFICATION", "SAFETY_REDIRECT"],
        },
        stage: {
          type: "string",
          enum: ["SAFE_REDIRECT", "CLARIFICATION", "DISCOVERY", "READY_TO_BOOK"],
        },
        requestedSpecialty: {
          type: ["string", "null"],
          description: "One of the available specialties that best matches the patient's need, or null if unclear.",
        },
      },
      required: ["reply", "intent", "stage", "requestedSpecialty"],
    },
  },
};

function systemPrompt(availableSpecialties: string[]): string {
  return [
    "You are CareFlow's patient access assistant. Your only job is administrative: helping a patient find and book an appointment.",
    "You must never diagnose a condition, interpret symptoms medically, or recommend or discuss medication or treatment.",
    "If the patient asks anything clinical (what they might have, what to take, whether something is serious), classify it as SAFETY_REDIRECT and write a brief reply explaining you can only help with scheduling and access, not medical advice.",
    `Available specialties at this hospital: ${availableSpecialties.join(", ") || "none currently listed"}.`,
    "If the patient's request maps to one of these specialties, set requestedSpecialty to it exactly as written above.",
    "If they haven't given enough to pick a specialty, day, or visit type yet, use CLARIFICATION and ask one concise question.",
    "If they've given enough to look for real availability, use FIND_APPOINTMENT (or BOOK_APPOINTMENT if they're clearly ready to pick a time).",
    "Keep replies to 1-3 sentences, plain language, no medical jargon.",
    "Always call the classify_patient_request tool exactly once with your classification.",
  ].join(" ");
}

/**
 * Uses Groq (Llama 3.3 70B by default) to turn a free-text patient message
 * into a structured intent. Returns null if no API key is configured or the
 * call fails, so callers can fall back to deterministic behavior rather than
 * breaking the demo.
 */
export async function classifyPatientMessage(
  message: string,
  history: ConversationTurn[],
  availableSpecialties: string[],
): Promise<ClassifiedIntent | null> {
  const groq = getClient();
  if (!groq) return null;

  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 500,
      messages: [
        { role: "system", content: systemPrompt(availableSpecialties) },
        ...history.slice(-8).map((turn) => ({
          role: turn.role,
          content: turn.text,
        })),
        { role: "user" as const, content: message },
      ],
      tools: [CLASSIFY_TOOL],
      tool_choice: { type: "function", function: { name: "classify_patient_request" } },
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.type !== "function") return null;

    const input = JSON.parse(toolCall.function.arguments) as Partial<ClassifiedIntent>;
    if (!input.reply || !input.intent || !input.stage) return null;

    return {
      reply: input.reply,
      intent: input.intent,
      stage: input.stage,
      requestedSpecialty: input.requestedSpecialty ?? null,
    };
  } catch (error) {
    logger.warn({ err: error }, "Groq classification failed; falling back to rule-based intent");
    return null;
  }
}
