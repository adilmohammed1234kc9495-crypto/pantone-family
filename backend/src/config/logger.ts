import winston from "winston";
import { env } from "./env";

const { combine, timestamp, printf, colorize, json } = winston.format;

const customFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] [${level}]: ${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  format: env.NODE_ENV === "production"
    ? combine(timestamp(), json())
    : combine(colorize(), timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), customFormat),
  transports: [
    new winston.transports.Console({
      silent: env.NODE_ENV === "test"
    })
  ]
});
