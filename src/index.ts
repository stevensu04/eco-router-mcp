#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./server.js";

// stdout is the MCP protocol channel: never console.log here, use stderr.
serveStdio(createServer, {
  onerror: (error) => console.error("[eco-router]", error),
});
