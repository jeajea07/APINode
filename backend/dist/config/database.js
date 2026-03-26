"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabase = connectDatabase;
exports.disconnectDatabase = disconnectDatabase;
const mongoose_1 = __importDefault(require("mongoose"));
let isConnected = false;
async function connectDatabase() {
    if (isConnected)
        return;
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("Missing MONGODB_URI environment variable");
    }
    await mongoose_1.default.connect(uri);
    isConnected = true;
}
async function disconnectDatabase() {
    if (!isConnected)
        return;
    await mongoose_1.default.disconnect();
    isConnected = false;
}
//# sourceMappingURL=database.js.map