import { find } from "lodash";
import type { Version3Client } from "jira.js";
import type { PluginConfig, GenerateNotesContext } from "./types";
import { Fields, Version } from "jira.js/out/version3/models";
import type { EditIssue } from "jira.js/out/version3/parameters";

export async function findOrCreateVersion(
  config: PluginConfig,
  context: GenerateNotesContext,
  jira: Version3Client,
  projectIdOrKey: string,
  name: string,
  description: string,
): Promise<Version> {
  const remoteProject = await jira.projects.getProject(projectIdOrKey);
  context.logger.info(`Looking for version with name '${name}'`);
  const existing = find(remoteProject.versions, { name });
  if (existing) {
    context.logger.info(`Found existing release '${existing.id}'`);
    return existing;
  }

  context.logger.info("No existing release found, creating new");

  let newVersion: Version;
  if (config.dryRun) {
    context.logger.info("dry-run: making a fake release");
    newVersion = {
      name,
      id: "dry_run_id",
    };
  } else {
    const descriptionText = description || "";
    const newVersionConfig: Version = {
      name,
      projectId: Number.parseInt(remoteProject.id, 10),
      description: descriptionText,
      released: Boolean(config.released),
    };
    if (config.setReleaseDate) {
      newVersionConfig.releaseDate = new Date().toISOString();
    }
    try {
      newVersion = await jira.projectVersions.createVersion(newVersionConfig);
    } catch (error) {
      newVersion = {};
      context.logger.info(
        `Failed to create new release '${newVersionConfig.name}'`,
      );
      throw new Error(`Failure to create new version: ${error}`);
    }
  }
  context.logger.info(`Made new release '${newVersion.id}'`);
  return newVersion;
}

export async function editIssueFixVersions(
  config: PluginConfig,
  context: GenerateNotesContext,
  jira: Version3Client,
  newVersion: Version,
  issueKey: string,
): Promise<void> {
  try {
    context.logger.info(`Adding issue ${issueKey} to '${newVersion.name}'`);
    if (!config.dryRun) {
      const currentIssue = await jira.issues.getIssue({ issueIdOrKey: issueKey, fields: ["fixVersions"] });

      const fixFieldUpdate: Partial<Fields> = {
        fixVersions: [
          ...currentIssue.fields.fixVersions.map((version) => ({
            id: version.id,
            name: version.name,
            self: version.self,
            description: version.description,
            archived: version.archived,
            released: version.released,
          })),
          {
            id: newVersion.id || "",
            name: newVersion.name || "",
            self: newVersion.self || "",
            description: newVersion.description || "",
            archived: newVersion.archived || false,
            released: newVersion.released || false,
          },
        ],
      };
      const issueUpdate: EditIssue = {
        issueIdOrKey: issueKey,
        fields: {
          ...fixFieldUpdate,
        },
      };
      await jira.issues.editIssue(issueUpdate);
    }
  } catch (err) {
    context.logger.error(`Unable to update issue ${issueKey} error: ${err}`);
    throw err;
  }
}
