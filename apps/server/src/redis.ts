import Redis from "ioredis";

/**
 * REDIS_URL=memory (or unset with USE_MEMORY_REDIS=1) swaps in an in-process
 * ioredis-compatible mock so the server runs without a Redis instance.
 */
export const useMemoryRedis = (process.env.REDIS_URL ?? "").toLowerCase() === "memory" || process.env.USE_MEMORY_REDIS === "1";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

function createClient(): Redis {
  if (useMemoryRedis) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RedisMock = require("ioredis-mock") as typeof Redis;
    console.log("[redis] using in-memory mock (REDIS_URL=memory)");
    return new RedisMock();
  }
  const client = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
  client.on("error", err => {
    console.error("Redis connection error", err);
  });
  return client;
}

export const redis: Redis = createClient();
