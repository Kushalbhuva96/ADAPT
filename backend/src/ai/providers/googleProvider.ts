import { GoogleGenAI } from "@google/genai";
import type { AIJsonSchema, AIProvider } from "../aiClient.js";

type AvailableModel = { name?: string; supportedActions?: string[] };

function modelId(name: string): string {
  return name.replace(/^models\//, "");
}

export function createGoogleAIProvider(apiKey: string, primaryModel: string, fallbackModel: string): AIProvider {
  const client = new GoogleGenAI({ apiKey, httpOptions: { timeout: 30_000 } });
  let availableModels: Promise<Set<string>> | undefined;

  async function getSupportedModels(): Promise<Set<string>> {
    if (!availableModels) {
      availableModels = (async () => {
        const available: AvailableModel[] = [];
        const pager = await client.models.list({ config: { pageSize: 100 } });
        for await (const model of pager) available.push(model as AvailableModel);

        const supported = available.filter((model) =>
          model.name && (!model.supportedActions?.length || model.supportedActions.includes("generateContent"))
        );
        return new Set(supported.map((model) => model.name).filter((name): name is string => Boolean(name)).map(modelId));
      })();
    }
    return availableModels;
  }

  return {
    async generateJson(systemPrompt: string, userPrompt: string, responseJsonSchema?: AIJsonSchema, requestedModel?: string): Promise<string> {
      const model = requestedModel === fallbackModel ? fallbackModel : primaryModel;
      const models = await getSupportedModels();
      if (!models.has(modelId(model))) {
        throw new Error(`Configured Gemini model is not available to this API key: ${model}`);
      }
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
