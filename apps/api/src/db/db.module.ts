import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service.js";

/** Global DB module — PrismaService is available in every feature module without re-importing. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DbModule {}
