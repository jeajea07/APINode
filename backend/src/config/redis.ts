import { ENV } from "./env";

export const redisConnection = {
  host: ENV.REDIS_HOST,
  port: ENV.REDIS_PORT
};

