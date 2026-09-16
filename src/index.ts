#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createCarbonProvider } from "./carbon/provider.js";
import { createServer } from "./server.js";

// One provider for the whole process, so the live-data cache is shared.
const carbon = createCarbonProvider({ token: process.env.ELECTRICITY_MAPS_API_TOKEN || undefined });

// stdout is the MCP protocol channel: never console.log here, use stderr.
serveStdio(() => createServer({ carbon }), {
  onerror: (error) => console.error("[eco-router]", error),
});
