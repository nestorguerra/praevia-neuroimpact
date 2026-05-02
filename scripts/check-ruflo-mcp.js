#!/usr/bin/env node

const { spawn } = require("child_process");

const command = process.env.RUFLO_MCP_COMMAND || "/Applications/Codex.app/Contents/bin/claude-flow-mcp";
const timeoutMs = Number(process.env.RUFLO_MCP_TIMEOUT_MS || 8000);

let nextId = 1;
let buffer = "";
let finished = false;

const child = spawn(command, [], {
  stdio: ["pipe", "pipe", "pipe"],
});

const timer = setTimeout(() => {
  finish(1, { ok: false, error: `Ruflo MCP check timed out after ${timeoutMs}ms` });
}, timeoutMs);

function send(method, params = {}) {
  child.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: nextId++,
    method,
    params,
  }) + "\n");
}

function finish(code, payload) {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  console.log(JSON.stringify(payload, null, 2));
  child.kill();
  process.exitCode = code;
}

child.on("error", (error) => {
  finish(1, { ok: false, error: error.message, command });
});

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop();

  for (const line of lines) {
    if (!line.trim()) continue;
    const message = JSON.parse(line);

    if (message.id === 1) {
      send("tools/list");
      continue;
    }

    if (message.id === 2) {
      const tools = message.result?.tools || [];
      finish(0, {
        ok: true,
        command,
        toolCount: tools.length,
        firstTools: tools.slice(0, 10).map((tool) => tool.name),
      });
    }
  }
});

send("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: {
    name: "praevia-neuroimpact-ruflo-check",
    version: "0.1.0",
  },
});

