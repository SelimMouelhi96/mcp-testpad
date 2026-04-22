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

// ── Helpers & shared schemas ────────────────────────────────────────────────

function buildParams(
  obj: Record<string, string | undefined>
): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

const testswithValues = ["none", "hashtags", "ids", "_ids"] as const;

function enumListParam<T extends readonly [string, ...string[]]>(
  values: T,
  description: string
) {
  const allowed = new Set<string>(values);
  return z
    .string()
    .optional()
    .refine(
      (value) =>
        value === undefined ||
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .every((item) => allowed.has(item)),
      {
        message: `Expected a comma-separated list from: ${values.join(", ")}`,
      }
    )
    .describe(description);
}

// Query-param schemas (reused across multiple tools)
const testsParam = z
  .enum(["none", "full", "list", "text"])
  .optional()
  .describe(
    "Include test items. Values: none, full, list, text. Default: none for folder endpoints, full for script endpoints."
  );
const testswithParam = enumListParam(
  testswithValues,
  "Modify how tests are returned when tests are included. Comma-separated values from: none, hashtags, ids, _ids."
);
const runsParam = z
  .enum(["none", "full", "terse"])
  .optional()
  .describe(
    "Include test runs. Values: none, full, terse. Default: none for folder endpoints, full for script endpoints."
  );
const resultsParam = z
  .enum(["none", "full"])
  .optional()
  .describe(
    "Include run results. Values: none, full. Default: none for folder endpoints, full for script endpoints."
  );
const fieldsParam = z
  .enum(["none", "full", "list", "list_shown"])
  .optional()
  .describe(
    "Include field definitions. Values: none, full, list, list_shown. Default: none for folder endpoints, full for script endpoints."
  );
const progressParam = z
  .enum(["none", "terse", "full"])
  .optional()
  .describe(
    "Include progress summary. Values: none, terse, full. Default: none for folder endpoints, terse for script endpoints."
  );
const retestsParam = z
  .enum(["latest", "all"])
  .optional()
  .describe("Include retest information. Values: latest, all. Default: latest.");
const subfoldersParam = z
  .enum(["none", "all"])
  .optional()
  .describe("Include subfolders. Values: none, all. Default: all.");
const scriptsQueryParam = z
  .enum(["terse", "full"])
  .optional()
  .describe("Include scripts. Values: terse, full. Default: terse for folder endpoints.");
const scriptTestsParam = testsParam.describe(
  "Include test items. For get_script, the API default is full."
);
const scriptRunsParam = runsParam.describe(
  "Include test runs. For get_script, the API default is full."
);
const scriptResultsParam = resultsParam.describe(
  "Include run results. For get_script, the API default is full."
);
const scriptFieldsParam = fieldsParam.describe(
  "Include custom field definitions. For get_script, the API default is full."
);
const scriptProgressParam = progressParam.describe(
  "Include progress summary. For get_script, the API default is terse."
);
const scriptRetestsParam = retestsParam.describe(
  "Include retest information when supported by the API."
);

// Test item schema (for create_script)
const testItemSchema = z.object({
  name: z.string().describe("Test step description"),
  indent: z
    .number()
    .optional()
    .describe(
      "Indentation level (0=test case header, 1=section, 2=step). Defaults to 0."
    ),
  tags: z
    .string()
    .optional()
    .describe("Comma-separated tags for the test item"),
});

// Field definition schema (for create_script)
const fieldDefSchema = z.union([
  z.string().describe("Field name (string shorthand)"),
  z
    .object({
      name: z.string().describe("Field name"),
      type: z
        .enum(["text", "number", "date", "dropdown"])
        .optional()
        .describe("Field type"),
      values: z
        .array(z.string())
        .optional()
        .describe("Allowed values (for dropdown type)"),
    })
    .describe("Field definition object"),
]);

// Test result value (the status string)
const testResultString = z
  .enum(["pass", "fail", "blocked", "query", "exclude"])
  .describe("Test result status");

// Array format: [result, comment?, issue?]
const testResultArray = z
  .tuple([testResultString])
  .rest(z.string())
  .describe(
    'Array format: [result] or [result, comment] or [result, comment, issue]'
  );

// Object format: { result, comment?, issue? }
const testResultObject = z
  .object({
    result: testResultString,
    comment: z.string().optional().describe("Optional comment for the result"),
    issue: z.string().optional().describe("Optional issue tracker reference"),
  })
  .describe("Object format with named fields");

// Union of all result formats
const testResultValue = z.union([
  testResultString,
  testResultArray,
  testResultObject,
]);

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
  {
    project_id: z.number().describe("The project ID"),
    subfolders: subfoldersParam,
    scripts: scriptsQueryParam,
    tests: testsParam,
    testswith: testswithParam,
    fields: fieldsParam,
    runs: runsParam,
    retests: retestsParam,
    results: resultsParam,
    progress: progressParam,
  },
  async ({ project_id, subfolders, scripts, tests, testswith, fields, runs, retests, results, progress }) => {
    const params = buildParams({ subfolders, scripts, tests, testswith, fields, runs, retests, results, progress });
    const data = await client.getFolders(project_id, params);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "get_folder",
  "Get a specific folder in a project",
  {
    project_id: z.number().describe("The project ID"),
    folder_id: z.string().describe("The folder ID"),
    subfolders: subfoldersParam,
    scripts: scriptsQueryParam,
    tests: testsParam,
    testswith: testswithParam,
    fields: fieldsParam,
    runs: runsParam,
    retests: retestsParam,
    results: resultsParam,
    progress: progressParam,
  },
  async ({ project_id, folder_id, subfolders, scripts, tests, testswith, fields, runs, retests, results, progress }) => {
    const params = buildParams({ subfolders, scripts, tests, testswith, fields, runs, retests, results, progress });
    const data = await client.getFolder(project_id, folder_id, params);
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
  {
    script_id: z.number().describe("The script ID"),
    tests: scriptTestsParam,
    testswith: testswithParam,
    runs: scriptRunsParam,
    results: scriptResultsParam,
    fields: scriptFieldsParam,
    progress: scriptProgressParam,
    retests: scriptRetestsParam,
  },
  async ({ script_id, tests, testswith, runs, results, fields, progress, retests }) => {
    const params = buildParams({
      tests: tests ?? "full",
      testswith,
      runs: runs ?? "full",
      results: results ?? "full",
      fields: fields ?? "full",
      progress: progress ?? "terse",
      retests,
    });
    const data = await client.getScript(script_id, params);
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
      .array(testItemSchema)
      .optional()
      .describe("Array of test steps to include in the script"),
    fields: z
      .array(fieldDefSchema)
      .optional()
      .describe("Custom field definitions for the script"),
  },
  async ({ project_id, name, tests, fields }) => {
    const mappedTests = tests?.map((t) => ({
      text: t.name,
      ...(t.indent !== undefined ? { indent: t.indent } : {}),
      ...(t.tags !== undefined ? { tags: t.tags } : {}),
    }));
    const data = await client.createScript(project_id, {
      name,
      tests: mappedTests,
      ...(fields !== undefined ? { fields } : {}),
    });
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
      .array(testItemSchema)
      .optional()
      .describe("Array of test steps to include in the script"),
    fields: z
      .array(fieldDefSchema)
      .optional()
      .describe("Custom field definitions for the script"),
  },
  async ({ project_id, folder_id, name, tests, fields }) => {
    const mappedTests = tests?.map((t) => ({
      text: t.name,
      ...(t.indent !== undefined ? { indent: t.indent } : {}),
      ...(t.tags !== undefined ? { tags: t.tags } : {}),
    }));
    const data = await client.createScriptInFolder(project_id, folder_id, {
      name,
      tests: mappedTests,
      ...(fields !== undefined ? { fields } : {}),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "modify_script",
  "Modify an existing test script (partial update). Can update name, description, and test items (text, indent).",
  {
    script_id: z.number().describe("The script ID"),
    name: z.string().optional().describe("New name for the script"),
    description: z.string().optional().describe("New description for the script"),
    tests: z
      .array(
        z.object({
          id: z.number().describe("The test item ID to modify"),
          text: z.string().optional().describe("New text for the test item"),
          indent: z.number().optional().describe("New indentation level"),
        })
      )
      .optional()
      .describe("Array of test items to update (identified by id)"),
  },
  async ({ script_id, name, description, tests }) => {
    const body: Record<string, unknown> = {};
    if (name !== undefined) body.name = name;
    if (description !== undefined) body.description = description;
    if (tests !== undefined) body.tests = tests;
    const data = await client.modifyScript(script_id, body);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ── Test Runs ───────────────────────────────────────────────────────────────

server.tool(
  "add_test_run",
  "Submit test run results for a script. Results map test IDs to a status string, an array [result, comment?, issue?], or an object {result, comment?, issue?}.",
  {
    script_id: z.number().describe("The script ID"),
    headers: z
      .record(z.string(), z.string())
      .optional()
      .describe(
        "Custom metadata headers (e.g. build version, environment). Only pre-defined header fields are accepted."
      ),
    results: z
      .record(z.string(), testResultValue)
      .optional()
      .describe(
        'Test results mapping test ID to: a status string ("pass","fail","blocked","query","exclude"), an array [result, comment?, issue?], or an object {result, comment?, issue?}'
      ),
    completed: z
      .union([z.boolean(), z.literal("auto")])
      .optional()
      .describe(
        'Whether the run is complete. true = mark complete, false = leave in progress, "auto" = complete if all tests have results.'
      ),
  },
  async ({ script_id, headers, results, completed }) => {
    const data = await client.addTestRun(script_id, {
      headers,
      results: results as Record<string, unknown> | undefined,
      completed,
    });
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
