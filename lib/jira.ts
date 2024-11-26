import { Version3Client } from "jira.js";
import type { PluginConfig, PluginContext } from "./types";

export function createClient(
  config: PluginConfig,
  context: PluginContext,
): Version3Client {
  return new Version3Client({
    host: config.jiraHost,
    authentication: {
      basic: {
        email: context.env.JIRA_USER || "",
        apiToken: context.env.JIRA_TOKEN || "",
      },
    },
  });
}
