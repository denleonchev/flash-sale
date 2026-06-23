import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { GroqService } from "../ai/groq.service.js";

export interface ImprovedSaleCopy {
  title: string;
  description: string;
}

@Injectable()
export class SalesAiService {
  constructor(private readonly groq: GroqService) {}

  async improveSaleCopy(title: string, description: string): Promise<ImprovedSaleCopy> {
    const raw = await this.groq.chat([
      {
        role: "system",
        content:
          'You are a copywriter for a flash-sale platform. Given a sale title and description, return an improved, more compelling version. Respond ONLY with valid JSON: {"title": "...", "description": "..."}. Keep title under 120 characters.',
      },
      {
        role: "user",
        content: JSON.stringify({ title, description }),
      },
    ]);

    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("no JSON block");
      const parsed = JSON.parse(match[0]) as { title?: unknown; description?: unknown };
      if (typeof parsed.title !== "string" || typeof parsed.description !== "string") {
        throw new Error("unexpected shape");
      }
      return { title: parsed.title.slice(0, 120), description: parsed.description };
    } catch {
      throw new InternalServerErrorException("Failed to parse Groq response");
    }
  }
}
