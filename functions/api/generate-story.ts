// POST /api/generate-story  (Cloudflare Pages Function)
// Streams the story as Server-Sent Events: { text } chunks, then { done: true }.
// The Gemini API key lives ONLY in the server environment (GEMINI_API_KEY).

import { GoogleGenAI } from "@google/genai";
import { checkRateLimit, getClientIp } from "../../lib/rate-limit";

// gemini-2.5-flash-lite is the fastest model; override with GEMINI_TEXT_MODEL.
const DEFAULT_TEXT_MODEL = "gemini-2.5-flash-lite";

const SYSTEM_INSTRUCTION =
  "You are a world-class children's author writing stories for 5-year-old boys. " +
  "Your stories are gentle, imaginative, and end the way the requested story type asks for " +
  "(sleepy and calm for bedtime, uplifting for encouraging, funny for funny stories). " +
  "If writing in Burmese, use the name 'နိုအာ' for the main character Noah.";

interface PagesContext {
  request: Request;
  env: Record<string, string | undefined>;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Story service is not configured on the server." }, { status: 500 });
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(`story:${ip}`, 10, 60 * 60 * 1000)) {
    return Response.json(
      { error: "Too many stories right now — please try again in an hour. 🌙" },
      { status: 429 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const prompt = body.prompt;
  if (typeof prompt !== "string" || prompt.trim().length === 0 || prompt.length > 3000) {
    return Response.json({ error: "Please provide a valid story prompt." }, { status: 400 });
  }

  const model = env.GEMINI_TEXT_MODEL || DEFAULT_TEXT_MODEL;
  const ai = new GoogleGenAI({ apiKey });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        const genStream = await ai.models.generateContentStream({
          model,
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            maxOutputTokens: 1500, // keeps long stories from running away
          },
        });
        for await (const chunk of genStream) {
          if (chunk.text) send({ text: chunk.text });
        }
        send({ done: true });
      } catch (err) {
        console.error("generate-story failed:", err);
        send({ error: "The stars are a bit cloudy tonight. Please try weaving the story again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
