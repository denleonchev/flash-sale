import { Injectable, InternalServerErrorException } from "@nestjs/common";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqResponse {
  choices: Array<{ message: { content: string } }>;
}

// GROQ_MODEL defaults to a fast, capable model; override per deployment (NFR-8).
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

@Injectable()
export class GroqService {
  private readonly apiKey = process.env["GROQ_API_KEY"] ?? "";
  private readonly model = process.env["GROQ_MODEL"] ?? DEFAULT_MODEL;

  async chat(messages: ChatMessage[]): Promise<string> {
    if (!this.apiKey) throw new InternalServerErrorException("GROQ_API_KEY is not set");

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 512,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      throw new InternalServerErrorException(`Groq API error: ${res.status}`);
    }

    const data = (await res.json()) as GroqResponse;
    return data.choices[0]?.message?.content ?? "";
  }
}
