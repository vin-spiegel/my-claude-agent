import { query } from "@anthropic-ai/claude-agent-sdk";
import { config } from "dotenv";

// Load environment variables
config();

async function main() {
  console.log("🤖 Starting Claude Local Agent with OpenRouter...\n");

  // Example: Using Skills automatically
  const prompt = process.argv[2] || "What skills are available?";

  console.log(`📝 Prompt: ${prompt}\n`);

  for await (const message of query({
    prompt,
    options: {
      // Load Skills from filesystem
      settingSources: ["user", "project"],

      // Enable Skill tool and other essential tools
      allowedTools: ["Skill", "Read", "Write", "Edit", "Bash", "Grep", "Glob"],

      // Project directory (contains .claude/skills/)
      cwd: process.cwd(),

      // Model configuration (from .env or default)
      model: process.env.DEFAULT_MODEL || "anthropic/claude-sonnet-4",

      // Optional: Budget limit
      maxBudgetUsd: process.env.MAX_BUDGET_USD
        ? parseFloat(process.env.MAX_BUDGET_USD)
        : undefined,

      // Permission mode
      permissionMode: "acceptEdits",

      // Environment variables are automatically loaded from process.env
      // ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL
    },
  })) {
    // Print all messages
    console.log(message);
  }

  console.log("\n✅ Task completed!");
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
