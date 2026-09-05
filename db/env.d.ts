declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    WORKFORCE_COMPASS_ALLOW_INSECURE_LOCAL?: string;
    WORKFORCE_COMPASS_AUTH_TOKEN?: string;
    WORKFORCE_COMPASS_TRUST_SITES_IDENTITY?: string;
    WORKFORCE_COMPASS_TRUSTED_USER_HEADER?: string;
  }
}
