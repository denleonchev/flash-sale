import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { timingSafeEqual, createHmac } from "node:crypto";
import type { IncomingMessage } from "node:http";

/**
 * Verifies the `X-Admin-Ticket` HMAC sent by the web BFF.
 * Same approach as socket-ticket verification — timingSafeEqual prevents
 * timing-based forgery. (NFR-7, NFR-9)
 * Shared secret: `ADMIN_TICKET_SECRET` env var. (NFR-8)
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<IncomingMessage>();
    const ticket = req.headers["x-admin-ticket"];
    if (typeof ticket !== "string" || !this.verify(ticket)) {
      throw new ForbiddenException("admin only");
    }
    return true;
  }

  private verify(ticket: string): boolean {
    const secret = process.env.ADMIN_TICKET_SECRET;
    if (!secret) return false;

    const dot = ticket.indexOf(".");
    if (dot === -1) return false;

    const expStr = ticket.slice(0, dot);
    const receivedSig = ticket.slice(dot + 1);

    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) return false;

    const computedSig = createHmac("sha256", secret).update(expStr).digest("base64url");

    const a = Buffer.from(receivedSig, "base64url");
    const b = Buffer.from(computedSig, "base64url");
    if (a.length !== b.length) return false;

    return timingSafeEqual(a, b);
  }
}
