#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createCarbonProvider } from "./carbon/provider.js";
import { detectSystemTimeZone } from "./engine/time.js";
import { createServer } from "./server.js";

// One provider for the whole process, so the live-data cache is shared.
const carbon = createCarbonProvider({ token: process.env.ELECTRICITY_MAPS_API_TOKEN || undefined });

// stdout is the MCP protocol channel: never console.log here, use stderr.
// Eco Router runs on the user's machine over stdio, so its time zone is the user's.
const systemTimeZone = detectSystemTimeZone();

serveStdio(() => createServer({ carbon, systemTimeZone }), {
  onerror: (error) => console.error("[eco-router]", error),
});
