type OriginCallback = (error: Error | null, allow?: boolean) => void;

export function createCorsOptions(allowedOrigins: readonly string[]) {
  const allowlist = new Set(allowedOrigins);
  return {
    origin(origin: string | undefined, callback: OriginCallback): void {
      if (origin === undefined) {
        callback(null, true);
        return;
      }
      callback(null, allowlist.has(origin));
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Authorization', 'Content-Type'],
    exposedHeaders: ['Content-Disposition', 'Content-Length', 'Content-Type'],
    credentials: false,
  };
}
