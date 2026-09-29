// POST /api/generate-image  (Cloudflare Pages Function)
// Returns { image } (data URL) or { error }. Image failures are non-fatal:
// the client shows the story without an illustration.

import { GoogleGenAI } from "@google/genai";
import { checkRateLimit, getClientIp } from "../../lib/rate-limit";

const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";

interface PagesContext {
  request: Request;
  env: Record<string, string | undefined>;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Image service is not configured on the server." }, { status: 500 });
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(`image:${ip}`, 10, 60 * 60 * 1000)) {
    return Response.json(
      { error: "Too many illustrations right now — please try again later." },
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
  if (typeof prompt !== "string" || prompt.trim().length === 0 || prompt.length > 1000) {
    return Response.json({ error: "Please provide a valid image prompt." }, { status: 400 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: env.GEMINI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
      contents: { parts: [{ text: prompt }] },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const data = (part as { inlineData?: { data?: string } }).inlineData?.data;
      if (data) {
        return Response.json({ image: `data:image/png;base64,${data}` });
      }
    }
    return Response.json({ error: "Illustration could not be created this time." }, { status: 500 });
  } catch (err) {
    console.error("generate-image failed:", err);
    return Response.json({ error: "Illustration could not be created this time." }, { status: 500 });
  }
}
