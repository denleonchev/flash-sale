import { Injectable } from "@nestjs/common";
import { UsersRepository } from "./users.repository.js";

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  upsertBuyer(auth0Sub: string, email: string, name?: string): Promise<void> {
    return this.repo.upsert(auth0Sub, email, name);
  }
}
