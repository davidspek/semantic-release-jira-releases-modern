import { find } from "lodash";
import type { Version3Client } from "jira.js";
import type { PluginConfig, GenerateNotesContext } from "./types";
import type { Fields, Version } from "jira.js/out/version3/models";
import type { EditIssue } from "jira.js/out/version3/parameters";

export async function findOrCreateVersionModern(
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
      projectId: projectIdOrKey as unknown as number,
      description: descriptionText,
      released: Boolean(config.released),
      releaseDate: config.setReleaseDate ? new Date().toISOString() : undefined,
    };
    newVersion = await jira.projectVersions.createVersion(newVersionConfig);
  }

  context.logger.info(`Made new release '${newVersion.id}'`);
  return newVersion;
}

export async function editIssueFixVersionsModern(
  config: PluginConfig,
  context: GenerateNotesContext,
  jira: Version3Client,
  newVersion: Version,
  issueKey: string,
): Promise<void> {
  try {
    context.logger.info(`Adding issue ${issueKey} to '${newVersion.name}'`);
    if (!config.dryRun) {
      const fixFieldUpdate: Partial<Fields> = {
        fixVersions: [
          {
            id: newVersion.id || "",
            name: newVersion.name || "",
            self: newVersion.self || "",
            description: newVersion.description || "",
            archived: newVersion.archived || false,
            released: newVersion.released || true,
          },
        ],
      };
      const issueUpdate: EditIssue = {
        issueIdOrKey: issueKey,
        fields: {
          fixFieldUpdate,
        },
      };
      await jira.issues.editIssue(issueUpdate);
    }
  } catch (err) {
    const allowedStatusCodes = [400, 404];
    let statusCode = 0;
    if (typeof err === "string") {
      try {
        const errOut = JSON.parse(err) as { statusCode: number };
        statusCode = errOut.statusCode;
      } catch (err) {
        // it's not json :shrug:
      }
    } else {
      const { statusCode: possibleCode } = err as { statusCode?: number };
      if (possibleCode !== undefined) {
        statusCode = possibleCode;
      }
    }
    if (allowedStatusCodes.indexOf(statusCode) === -1) {
      throw err;
    }
    context.logger.error(
      `Unable to update issue ${issueKey} statusCode: ${statusCode}`,
    );
  }
}
