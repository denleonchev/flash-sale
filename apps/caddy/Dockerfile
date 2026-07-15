# Custom Caddy build — stock caddy:2-alpine has no rate-limit module built in.
# github.com/mholt/caddy-ratelimit backs the `rate_limit` directive used in
# ../../Caddyfile; it only ships via xcaddy, not the upstream image.
FROM caddy:2-builder-alpine AS builder

RUN xcaddy build \
    --with github.com/mholt/caddy-ratelimit

FROM caddy:2-alpine

COPY --from=builder /usr/bin/caddy /usr/bin/caddy
