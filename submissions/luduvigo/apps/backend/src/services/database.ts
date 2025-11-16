import mongoose from "mongoose";
import { ENV } from "../config/env";

let isConnected = false;

export async function connectDatabase(): Promise<void> {
  if (isConnected) {
    console.log("Using existing MongoDB connection");
    return;
  }

  // Try both ENV object and process.env directly
  const mongoUri =
    ENV.MONGODB_CONNECTION_STRING || process.env.MONGODB_CONNECTION_STRING;

  console.log("Checking MongoDB connection string...");
  console.log(
    `   ENV.MONGODB_CONNECTION_STRING: ${
      ENV.MONGODB_CONNECTION_STRING ? "SET" : "NOT SET"
    }`
  );
  console.log(
    `   process.env.MONGODB_CONNECTION_STRING: ${
      process.env.MONGODB_CONNECTION_STRING ? "SET" : "NOT SET"
    }`
  );

  if (!mongoUri) {
    console.warn(
      "MONGODB_CONNECTION_STRING is not defined - APY tracking will be disabled"
    );
    console.warn(
      "Make sure your .env file contains: MONGODB_CONNECTION_STRING=your_connection_string"
    );
    return;
  }

  try {
    console.log("Connecting to MongoDB...");

    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.log("MongoDB connected successfully");

    // Handle connection events
    mongoose.connection.on("error", (error) => {
      console.error("MongoDB connection error:", error);
      isConnected = false;
    });

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB disconnected");
      isConnected = false;
    });

    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected");
      isConnected = true;
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    isConnected = false;
    throw error;
  }
}

export function getDatabaseStatus(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.connection.close();
    isConnected = false;
    console.log("MongoDB disconnected gracefully");
  } catch (error) {
    console.error("Error disconnecting from MongoDB:", error);
    throw error;
  }
}
