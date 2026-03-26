"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = void 0;
require("dotenv/config");
const node_path_1 = __importDefault(require("node:path"));
function toPort(value, fallback) {
    const n = Number(value ?? fallback);
    return Number.isFinite(n) ? n : fallback;
}
exports.ENV = {
    MONGO_URI: process.env.MONGODB_URI ?? "mongodb://localhost:27017/pdf_db",
    REDIS_HOST: process.env.REDIS_HOST ?? "localhost",
    REDIS_PORT: toPort(process.env.REDIS_PORT, 6379),
    PDF: {
        STORAGE_PATH: node_path_1.default.resolve(process.env.PDF_STORAGE_PATH ?? "storage/pdfs"),
        PREFIX: process.env.PDF_PREFIX ?? "user_"
    }
};
//# sourceMappingURL=env.js.map