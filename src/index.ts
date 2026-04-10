#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { TestPadClient } from "./testpad-client.js";

const token = process.env.TESTPAD_API_TOKEN;
if (!token) {
  console.error("Error: TESTPAD_API_TOKEN environment variable is required");
  process.exit(1);
}

const client = new TestPadClient(token);

const server = new McpServer({
  name: "mcp-testpad",
  version: "1.0.0",
});

// ── Projects ────────────────────────────────────────────────────────────────

server.tool(
  "list_projects",
  "List all active TestPad projects visible to the API key",
  async () => {
    const data = await client.listProjects();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "get_project",
  "Get details of a specific TestPad project",
  { project_id: z.number().describe("The project ID") },
  async ({ project_id }) => {
    const data = await client.getProject(project_id);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ── Folders ─────────────────────────────────────────────────────────────────

server.tool(
  "get_folders",
  "Get all folders (nested content tree) for a project",
  { project_id: z.number().describe("The project ID") },
  async ({ project_id }) => {
    const data = await client.getFolders(project_id);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "get_folder",
  "Get a specific folder in a project",
  {
    project_id: z.number().describe("The project ID"),
    folder_id: z.string().describe("The folder ID"),
  },
  async ({ project_id, folder_id }) => {
    const data = await client.getFolder(project_id, folder_id);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "create_folder",
  "Create a new folder at the root level of a project",
  {
    project_id: z.number().describe("The project ID"),
    name: z.string().describe("Name for the new folder"),
  },
  async ({ project_id, name }) => {
    const data = await client.createFolder(project_id, { name });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "create_subfolder",
  "Create a subfolder inside an existing folder",
  {
    project_id: z.number().describe("The project ID"),
    folder_id: z.string().describe("The parent folder ID"),
    name: z.string().describe("Name for the new subfolder"),
  },
  async ({ project_id, folder_id, name }) => {
    const data = await client.createSubfolder(project_id, folder_id, { name });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "modify_folder",
  "Modify properties of an existing folder (partial update)",
  {
    project_id: z.number().describe("The project ID"),
    folder_id: z.string().describe("The folder ID"),
    name: z.string().optional().describe("New name for the folder"),
  },
  async ({ project_id, folder_id, name }) => {
    const data = await client.modifyFolder(project_id, folder_id, { name });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ── Scripts ─────────────────────────────────────────────────────────────────

server.tool(
  "get_script",
  "Get a specific test script with its tests and runs",
  { script_id: z.number().describe("The script ID") },
  async ({ script_id }) => {
    const data = await client.getScript(script_id);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "create_script",
  "Create a test script at the root level of a project",
  {
    project_id: z.number().describe("The project ID"),
    name: z.string().describe("Name for the test script"),
    tests: z
      .array(
        z.object({
          name: z.string().describe("Test step description"),
        })
      )
      .optional()
      .describe("Array of test steps to include in the script"),
  },
  async ({ project_id, name, tests }) => {
    const data = await client.createScript(project_id, { name, tests });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "create_script_in_folder",
  "Create a test script inside a specific folder",
  {
    project_id: z.number().describe("The project ID"),
    folder_id: z.string().describe("The folder ID"),
    name: z.string().describe("Name for the test script"),
    tests: z
      .array(
        z.object({
          name: z.string().describe("Test step description"),
        })
      )
      .optional()
      .describe("Array of test steps to include in the script"),
  },
  async ({ project_id, folder_id, name, tests }) => {
    const data = await client.createScriptInFolder(project_id, folder_id, {
      name,
      tests,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ── Test Runs ───────────────────────────────────────────────────────────────

server.tool(
  "add_test_run",
  "Submit test run results for a script. Results map test IDs to pass/fail status.",
  {
    script_id: z.number().describe("The script ID"),
    headers: z
      .record(z.string(), z.string())
      .optional()
      .describe(
        "Custom metadata headers (e.g. build version, environment). Only pre-defined header fields are accepted."
      ),
    results: z
      .record(z.string(), z.string())
      .optional()
      .describe(
        'Test results mapping test ID to status (e.g. {"2": "pass", "3": "fail"})'
      ),
  },
  async ({ script_id, headers, results }) => {
    const data = await client.addTestRun(script_id, { headers, results });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ── Notes ───────────────────────────────────────────────────────────────────

server.tool(
  "get_notes",
  "Get notes at the project level or inside a specific folder",
  {
    project_id: z.number().describe("The project ID"),
    folder_id: z
      .string()
      .optional()
      .describe("Optional folder ID. If omitted, returns project-level notes."),
  },
  async ({ project_id, folder_id }) => {
    const data = folder_id
      ? await client.getFolderNotes(project_id, folder_id)
      : await client.getProjectNotes(project_id);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "create_note",
  "Create a note at the project level or inside a specific folder",
  {
    project_id: z.number().describe("The project ID"),
    content: z.string().describe("The note content"),
    folder_id: z
      .string()
      .optional()
      .describe(
        "Optional folder ID. If omitted, creates a project-level note."
      ),
  },
  async ({ project_id, content, folder_id }) => {
    const data = folder_id
      ? await client.createFolderNote(project_id, folder_id, { content })
      : await client.createProjectNote(project_id, { content });
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

server.tool(
  "modify_note",
  "Modify an existing note (partial update)",
  {
    project_id: z.number().describe("The project ID"),
    note_id: z.string().describe("The note ID"),
    content: z.string().optional().describe("New content for the note"),
  },
  async ({ project_id, note_id, content }) => {
    const data = await client.modifyNote(project_id, note_id, { content });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ── Start server ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
