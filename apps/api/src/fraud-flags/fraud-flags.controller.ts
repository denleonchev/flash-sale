import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from "@nestjs/common";
import type { FraudFlag, FraudFlagStatus } from "@flash-sale/shared";
import { AdminGuard } from "../admin/admin.guard.js";
import { FraudFlagsService } from "./fraud-flags.service.js";

@Controller("admin/fraud-flags")
export class FraudFlagsController {
  constructor(private readonly service: FraudFlagsService) {}

  @UseGuards(AdminGuard)
  @Get()
  listFlags(@Query("status") status?: FraudFlagStatus): Promise<FraudFlag[]> {
    return this.service.listFlags(status);
  }

  @UseGuards(AdminGuard)
  @Patch(":id/review")
  reviewFlag(@Param("id", ParseUUIDPipe) id: string): Promise<FraudFlag> {
    return this.service.reviewFlag(id);
  }
}
