import { Command } from "commander";
import { createThreadDiscord, sendMessageDiscord } from "../discord/send.js";
import { loadConfig } from "../config/config.js";
import { danger } from "../globals.js";

function getDiscordToken(): string {
  const cfgToken = loadConfig().discord?.token;
  if (!cfgToken) {
    throw new Error("Discord token not configured in config file (discord.token)");
  }
  return cfgToken.trim();
}

export function registerDiscordCli(program: Command) {
  const discord = program
    .command("discord")
    .description("Discord utilities")
    .addHelpText(
      "after",
      `
Examples:
  clawdis discord send --to channel:123456789 --message "Hello"
  clawdis discord thread-create --channel-id 123456789 --message-id 987654321 --name "Thread Name"`,
    );

  // Send message
  discord
    .command("send")
    .description("Send a message to a Discord channel or user")
    .requiredOption("-t, --to <target>", "Target: channel:<id> or user:<id>")
    .requiredOption("-m, --message <text>", "Message body")
    .option("--reply-to <messageId>", "Message ID to reply to")
    .option("--json", "Output result as JSON", false)
    .action(async (opts) => {
      try {
        const token = getDiscordToken();
        const result = await sendMessageDiscord(
          opts.to,
          opts.message,
          { token, replyTo: opts.replyTo },
        );
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`Message sent: ${result.messageId}`);
        }
      } catch (err) {
        console.error(danger(`Failed to send message: ${String(err)}`));
        process.exit(1);
      }
    });

  // Create thread
  discord
    .command("thread-create")
    .description("Create a thread on an existing message")
    .requiredOption(
      "--channel-id <id>",
      "Channel ID where the message exists",
    )
    .requiredOption(
      "--message-id <id>",
      "Message ID to create thread on",
    )
    .requiredOption("--name <name>", "Thread name")
    .option(
      "--archive-duration <minutes>",
      "Auto-archive duration in minutes (60, 1440, 4320, 10080)",
      "1440",
    )
    .option("--json", "Output result as JSON", false)
    .action(async (opts) => {
      try {
        const token = getDiscordToken();
        const archiveDuration = Number.parseInt(opts.archiveDuration, 10);
        if (
          ![60, 1440, 4320, 10080].includes(archiveDuration)
        ) {
          console.error(
            danger(
              "Invalid archive duration. Must be 60, 1440, 4320, or 10080 minutes.",
            ),
          );
          process.exit(1);
        }
        const result = await createThreadDiscord(
          opts.channelId,
          {
            messageId: opts.messageId,
            name: opts.name,
            autoArchiveMinutes: archiveDuration,
          },
          { token },
        ) as { id: string };
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`Thread created: ${result.id}`);
        }
      } catch (err) {
        console.error(danger(`Failed to create thread: ${String(err)}`));
        process.exit(1);
      }
    });
}
