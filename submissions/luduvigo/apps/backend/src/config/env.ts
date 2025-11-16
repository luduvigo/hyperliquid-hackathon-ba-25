import dotenv from "dotenv";
import path from "path";
import { existsSync } from "fs";

// Get paths - handle both compiled JS and ts-node execution
let backendDir: string;
let rootDir: string;

try {
  // Try to use __dirname (works in compiled JS)
  backendDir = path.resolve(__dirname, "..");
  rootDir = path.resolve(backendDir, "../..");
} catch (e) {
  // Fallback for ts-node or other environments
  backendDir = path.resolve(process.cwd(), "src");
  rootDir = path.resolve(process.cwd(), "../..");
}

// Try multiple .env file locations
const envPaths = [
  path.join(backendDir, "..", ".env"), // apps/backend/.env
  path.join(rootDir, ".env"), // root/.env
  path.join(process.cwd(), ".env"), // current working directory
  path.join(process.cwd(), "apps", "backend", ".env"), // explicit backend path
];

console.log("Searching for .env file in:");
envPaths.forEach((p) => console.log(`   - ${p}`));

// Load the first .env file that exists
let loaded = false;
let loadedPath = "";

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log(`Loaded .env from: ${envPath}`);
      console.log(
        `Loaded ${
          Object.keys(result.parsed || {}).length
        } environment variables`
      );
      loaded = true;
      loadedPath = envPath;
      break;
    } else {
      console.log(`Error loading .env from ${envPath}:`, result.error);
    }
  }
}

// Fallback to default dotenv behavior (current directory)
if (!loaded) {
  const result = dotenv.config();
  if (!result.error && result.parsed && Object.keys(result.parsed).length > 0) {
    console.log("Loaded .env from default location (process.cwd())");
    console.log(
      `📋 Loaded ${Object.keys(result.parsed).length} environment variables`
    );
    loaded = true;
  }
}

if (!loaded) {
  console.warn(
    "⚠️  No .env file found. Using environment variables from system."
  );
} else {
  // Debug: Show if MONGODB_CONNECTION_STRING was loaded
  if (process.env.MONGODB_CONNECTION_STRING) {
    const masked =
      process.env.MONGODB_CONNECTION_STRING.substring(0, 20) + "...";
    console.log(`MONGODB_CONNECTION_STRING is set: ${masked}`);
  } else {
    console.warn(
      "MONGODB_CONNECTION_STRING is NOT set in environment variables"
    );
  }
}

// Export environment variables
export const ENV = {
  ASSET_TOKEN: process.env.ASSET_TOKEN || "",
  GLUEX_API_KEY: process.env.GLUEX_API_KEY || "",
  HYPEREVM_RPC_URL: process.env.HYPEREVM_RPC_URL || "",
  MONGODB_CONNECTION_STRING: process.env.MONGODB_CONNECTION_STRING || "",
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 3001,
  PRIVATE_KEY: process.env.PRIVATE_KEY || "",
  RPC_URL: process.env.RPC_URL || "",
  VAULT_ADDRESS: process.env.VAULT_ADDRESS || "",
};
