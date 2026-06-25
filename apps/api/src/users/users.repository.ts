import { Injectable } from "@nestjs/common";
import { PrismaService } from "../db/prisma.service.js";

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsert(auth0Sub: string, email: string, name?: string): Promise<void> {
    return this.prisma.db.user
      .upsert({
        where: { auth0Sub },
        create: { auth0Sub, email, name: name ?? null },
        // Always refresh email; update name only when provided (don't overwrite a
        // previously set name with null if the current login has no name claim).
        update: { email, ...(name !== undefined && { name }) },
        select: { id: true },
      })
      .then(() => undefined);
  }
}
