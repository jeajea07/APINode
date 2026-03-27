import winston from "winston";
import { ENV } from "./env";

export const logger = winston.createLogger({
  level: ENV.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: ENV.SERVICE_NAME
  },
  transports: [new winston.transports.Console()]
});

