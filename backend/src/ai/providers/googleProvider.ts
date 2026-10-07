import { GoogleGenAI } from "@google/genai";
import type { AIJsonSchema, AIProvider } from "../aiClient.js";

export function createGoogleAIProvider(apiKey: string, primaryModel: string, fallbackModel: string): AIProvider {
  const client = new GoogleGenAI({ apiKey, httpOptions: { timeout: 30_000 } });

  return {
    async generateJson(systemPrompt: string, userPrompt: string, responseJsonSchema?: AIJsonSchema, requestedModel?: string): Promise<string> {
      const model = requestedModel === fallbackModel ? fallbackModel : primaryModel;
      console.log(`[AI] Generating structured response with Google Gemini (${model}).`);
      const response = await client.models.generateContent({
        model,
        contents: `${systemPrompt}\n\n${userPrompt}`,
        config: {
          responseMimeType: "application/json",
          ...(responseJsonSchema ? { responseJsonSchema } : {}),
          temperature: 0.3,
        },
      });
      const text = response.text?.trim();
      if (!text) throw new SyntaxError("Gemini returned an empty response.");
      return text;
    },
  };
}
