import mongoose from "mongoose";
import { ENV } from "./env";

let isConnected = false;

export async function connectDatabase(): Promise<void> {
  if (isConnected) return;

  await mongoose.connect(ENV.MONGO_URI);
  isConnected = true;
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
}

