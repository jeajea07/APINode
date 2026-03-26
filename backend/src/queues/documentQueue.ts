import { Queue } from "bullmq";

import { redisConnection } from "../config/redis";

export const documentQueue = new Queue("pdf-generation", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000
    }
  }
});

