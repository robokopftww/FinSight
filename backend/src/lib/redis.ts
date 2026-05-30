import { env } from "../config/env.js";

let redisClient: unknown | null = null;

export async function getRedisClient() {
  if (!redisClient) {
    const module = await import("ioredis");
    const Redis = module.default as unknown as new (
      url: string,
      options: { lazyConnect: boolean; maxRetriesPerRequest: number },
    ) => unknown;

    redisClient = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  return redisClient;
}
