import winston from "winston";

const envLogLevel = process.env.LOG_LEVEL;

export const logger = winston.createLogger({
  level: envLogLevel ?? "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME ?? "api-node"
  },
  transports: [new winston.transports.Console()]
});

