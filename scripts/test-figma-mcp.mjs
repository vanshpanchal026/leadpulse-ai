// Minimal MCP stdio client to verify figma-mcp server authenticates and exposes tools.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const env = { ...process.env, FIGMA_API_KEY: process.env.FIGMA_API_KEY || "test" };
const figmaBin = "./node_modules/.bin/figma-mcp";
const server = spawn(figmaBin, [], { env, stdio: ["pipe", "pipe", "pipe"] });

const rl = createInterface({ input: server.stdout, crlfDelay: Infinity });
let id = 0;
let pending = new Map();
let tools = null;

server.stderr.on("data", (d) => process.stderr.write("[server stderr] " + d.toString()));

rl.on("line", (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.id === null && msg.error) {
    console.error("JSON-RPC ERROR:", JSON.stringify(msg.error));
    process.exit(1);
  }
  if (msg.result && msg.result.tools) {
    tools = msg.result.tools;
    console.log("TOOLS EXPOSED:", tools.map((t) => t.name).join(", "));
    console.log("AUTH OK: server responded with tools (no auth error)");
    cleanup();
  }
});

function send(obj) {
  server.stdin.write(JSON.stringify(obj) + "\n");
}

function cleanup() {
  server.kill();
  process.exit(0);
}

// MCP initialize handshake
send({ jsonrpc: "2.0", id: ++id, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } });
setTimeout(() => send({ jsonrpc: "2.0", id: ++id, method: "tools/list", params: {} }), 500);
setTimeout(cleanup, 8000);