import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { UNTRUSTED_RULE } from "./untrusted";

/**
 * The one helper every AI task goes through.
 *
 * It calls the Anthropic Messages API, forces the answer through a tool
 * schema so the model must return structured JSON with fixed fields, then
 * validates that JSON with zod before anything else in the app sees it.
 *
 * Nothing here ever decides pass or fail. Callers read the validated fields
 * and the *app* applies the rule. That separation is the point: a model that
 * is talked into saying "approved" still cannot approve anything.
 *
 * Server-only. The "server-only" import above makes a client import a build
 * error, and scripts/check-secrets.sh checks it independently.
 */

export const AI_MODEL = "claude-haiku-5-5";

export type Engine = "claude" | "offline";

export type AiResult<T> = {
  data: T;
  engine: Engine;
  model: string | null;
  /** Set when the offline engine ran because the real call was unavailable. */
  note?: string;
};

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!client) {
    client = new Anthropic({
      apiKey,
      maxRetries: 2,
      timeout: 45_000,
    });
  }
  return client;
}

/** An image handed to the model for one request and never stored. */
export type InlineImage = {
  mediaType: "image/jpeg" | "image/png";
  /** base64, no data: prefix */
  data: string;
};

export type StructuredCall<T> = {
  /** Short name used in logs and in the tool name. */
  task: string;
  /** Task-specific instructions. The untrusted-data rule is appended for you. */
  instructions: string;
  /** Already wrapped with dataBlock(). */
  blocks: string[];
  schema: z.ZodType<T>;
  /** What the tool is for, shown to the model. */
  toolDescription: string;
  maxTokens?: number;
  images?: InlineImage[];
  /** Runs when there is no API key, or the call or validation fails. */
  fallback: () => T;
};

/**
 * zod is the single source of truth: the tool's JSON Schema is generated from
 * the same schema that validates the reply, so the two cannot drift apart.
 */
function toolSchemaFrom(schema: z.ZodType<unknown>) {
  const json = z.toJSONSchema(schema, { target: "draft-7", io: "output" }) as Record<
    string,
    unknown
  >;
  // Anthropic requires a top-level object schema.
  if (json.type !== "object") {
    return { type: "object", properties: { value: json }, required: ["value"] };
  }
  delete json.$schema;
  return json;
}

export async function structured<T>(call: StructuredCall<T>): Promise<AiResult<T>> {
  const anthropic = getClient();

  if (!anthropic) {
    return {
      data: call.fallback(),
      engine: "offline",
      model: null,
      note: "No ANTHROPIC_API_KEY set — the built-in offline engine produced this.",
    };
  }

  const toolName = `record_${call.task}`.replace(/[^a-z0-9_]/gi, "_").slice(0, 60);
  const system = `${call.instructions.trim()}\n\n${UNTRUSTED_RULE}\n\nAnswer only by calling the ${toolName} tool.`;

  const content: Anthropic.ContentBlockParam[] = [];
  for (const image of call.images ?? []) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: image.mediaType, data: image.data },
    });
  }
  content.push({ type: "text", text: call.blocks.join("\n\n") });

  try {
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: call.maxTokens ?? 2048,
      system,
      tools: [
        {
          name: toolName,
          description: call.toolDescription,
          input_schema: toolSchemaFrom(call.schema) as Anthropic.Tool.InputSchema,
        },
      ],
      // Force the tool: the model cannot answer with free text.
      tool_choice: { type: "tool", name: toolName },
      messages: [{ role: "user", content }],
    });

    const block = response.content.find((c) => c.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      throw new Error("model did not call the tool");
    }

    const parsed = call.schema.safeParse(block.input);
    if (!parsed.success) {
      // A malformed reply is treated exactly like no reply.
      console.error(
        `[ai:${call.task}] schema validation failed:`,
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      );
      return {
        data: call.fallback(),
        engine: "offline",
        model: null,
        note: "The AI reply did not match the expected shape, so the offline engine was used.",
      };
    }

    return { data: parsed.data, engine: "claude", model: AI_MODEL };
  } catch (error) {
    console.error(`[ai:${call.task}]`, (error as Error).message);
    return {
      data: call.fallback(),
      engine: "offline",
      model: null,
      note: "The AI service could not be reached, so the offline engine was used.",
    };
  }
}
