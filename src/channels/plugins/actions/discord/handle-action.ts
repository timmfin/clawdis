import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import {
  readNumberParam,
  readStringArrayParam,
  readStringParam,
} from "../../../../agents/tools/common.js";
import { handleDiscordAction } from "../../../../agents/tools/discord-actions.js";
import { fetchChannelInfoDiscord } from "../../../../discord/send.js";
import type { ChannelMessageActionContext } from "../../types.js";
import { tryHandleDiscordMessageActionGuildAdmin } from "./handle-action.guild-admin.js";

const providerId = "discord";

function readParentIdParam(params: Record<string, unknown>): string | null | undefined {
  if (params.clearParent === true) return null;
  if (params.parentId === null) return null;
  return readStringParam(params, "parentId");
}

function resolveBoundDiscordChannelId(toolContext: ChannelMessageActionContext["toolContext"]): string | undefined {
  const raw = toolContext?.currentChannelId?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("channel:")) return raw.slice("channel:".length).trim() || undefined;
  return raw;
}

async function assertDiscordThreadInCurrentChannel(params: {
  threadId: string;
  ctx: Pick<ChannelMessageActionContext, "toolContext" | "accountId">;
}): Promise<void> {
  const currentChannelId = resolveBoundDiscordChannelId(params.ctx.toolContext);
  if (!currentChannelId) return;
  if (params.threadId === currentChannelId) return;

  const thread = await fetchChannelInfoDiscord(params.threadId, {
    accountId: params.ctx.accountId ?? undefined,
  });
  const parentId = (thread as { parent_id?: unknown }).parent_id;
  if (typeof parentId !== "string" || !parentId.trim()) {
    throw new Error(
      `Refusing to act on Discord thread "${params.threadId}": unable to resolve its parent channel.`,
    );
  }
  if (parentId !== currentChannelId) {
    throw new Error(
      `Refusing to act on Discord thread "${params.threadId}": it belongs to channel "${parentId}", but the current channel is "${currentChannelId}".`,
    );
  }
}

export async function handleDiscordMessageAction(
  ctx: Pick<ChannelMessageActionContext, "action" | "params" | "cfg" | "toolContext" | "accountId">,
): Promise<AgentToolResult<unknown>> {
  const { action, params, cfg } = ctx;

  const resolveChannelId = () =>
    readStringParam(params, "channelId") ?? readStringParam(params, "to", { required: true });

  if (action === "send") {
    const to = readStringParam(params, "to", { required: true });
    const content = readStringParam(params, "message", {
      required: true,
      allowEmpty: true,
    });
    const mediaUrl = readStringParam(params, "media", { trim: false });
    const replyTo = readStringParam(params, "replyTo");
    return await handleDiscordAction(
      {
        action: "sendMessage",
        to,
        content,
        mediaUrl: mediaUrl ?? undefined,
        replyTo: replyTo ?? undefined,
      },
      cfg,
    );
  }

  if (action === "poll") {
    const to = readStringParam(params, "to", { required: true });
    const question = readStringParam(params, "pollQuestion", {
      required: true,
    });
    const answers = readStringArrayParam(params, "pollOption", { required: true }) ?? [];
    const allowMultiselect = typeof params.pollMulti === "boolean" ? params.pollMulti : undefined;
    const durationHours = readNumberParam(params, "pollDurationHours", {
      integer: true,
    });
    return await handleDiscordAction(
      {
        action: "poll",
        to,
        question,
        answers,
        allowMultiselect,
        durationHours: durationHours ?? undefined,
        content: readStringParam(params, "message"),
      },
      cfg,
    );
  }

  if (action === "react") {
    const messageId = readStringParam(params, "messageId", { required: true });
    const emoji = readStringParam(params, "emoji", { allowEmpty: true });
    const remove = typeof params.remove === "boolean" ? params.remove : undefined;
    return await handleDiscordAction(
      {
        action: "react",
        channelId: resolveChannelId(),
        messageId,
        emoji,
        remove,
      },
      cfg,
    );
  }

  if (action === "reactions") {
    const messageId = readStringParam(params, "messageId", { required: true });
    const limit = readNumberParam(params, "limit", { integer: true });
    return await handleDiscordAction(
      { action: "reactions", channelId: resolveChannelId(), messageId, limit },
      cfg,
    );
  }

  if (action === "read") {
    const limit = readNumberParam(params, "limit", { integer: true });
    return await handleDiscordAction(
      {
        action: "readMessages",
        channelId: resolveChannelId(),
        limit,
        before: readStringParam(params, "before"),
        after: readStringParam(params, "after"),
        around: readStringParam(params, "around"),
      },
      cfg,
    );
  }

  if (action === "edit") {
    const messageId = readStringParam(params, "messageId", { required: true });
    const content = readStringParam(params, "message", { required: true });
    return await handleDiscordAction(
      {
        action: "editMessage",
        channelId: resolveChannelId(),
        messageId,
        content,
      },
      cfg,
    );
  }

  if (action === "delete") {
    const messageId = readStringParam(params, "messageId", { required: true });
    return await handleDiscordAction(
      { action: "deleteMessage", channelId: resolveChannelId(), messageId },
      cfg,
    );
  }

  if (action === "pin" || action === "unpin" || action === "list-pins") {
    const messageId =
      action === "list-pins" ? undefined : readStringParam(params, "messageId", { required: true });
    return await handleDiscordAction(
      {
        action: action === "pin" ? "pinMessage" : action === "unpin" ? "unpinMessage" : "listPins",
        channelId: resolveChannelId(),
        messageId,
      },
      cfg,
    );
  }

  if (action === "permissions") {
    return await handleDiscordAction({ action: "permissions", channelId: resolveChannelId() }, cfg);
  }

  if (action === "thread-create") {
    const name = readStringParam(params, "threadName", { required: true });
    const messageId = readStringParam(params, "messageId");
    const autoArchiveMinutes = readNumberParam(params, "autoArchiveMin", {
      integer: true,
    });
    const type =
      messageId !== undefined
        ? undefined
        : (readNumberParam(params, "type", { integer: true }) ??
          readNumberParam(params, "threadType", { integer: true }));
    return await handleDiscordAction(
      {
        action: "threadCreate",
        channelId: resolveChannelId(),
        name,
        messageId,
        autoArchiveMinutes,
        type,
      },
      cfg,
    );
  }

  if (action === "thread-delete") {
    const threadId = readStringParam(params, "threadId", { required: true });
    await assertDiscordThreadInCurrentChannel({ threadId, ctx });
    return await handleDiscordAction(
      {
        action: "threadDelete",
        channelId: threadId,
      },
      cfg,
    );
  }

  if (action === "thread-rename") {
    const threadId = readStringParam(params, "threadId", { required: true });
    const name =
      readStringParam(params, "threadName") ??
      readStringParam(params, "name", { required: true });
    await assertDiscordThreadInCurrentChannel({ threadId, ctx });
    return await handleDiscordAction(
      {
        action: "threadRename",
        channelId: threadId,
        name,
      },
      cfg,
    );
  }

  if (action === "sticker") {
    const stickerIds =
      readStringArrayParam(params, "stickerId", {
        required: true,
        label: "sticker-id",
      }) ?? [];
    return await handleDiscordAction(
      {
        action: "sticker",
        to: readStringParam(params, "to", { required: true }),
        stickerIds,
        content: readStringParam(params, "message"),
      },
      cfg,
    );
  }

  const adminResult = await tryHandleDiscordMessageActionGuildAdmin({
    ctx,
    resolveChannelId,
    readParentIdParam,
  });
  if (adminResult !== undefined) return adminResult;

  throw new Error(`Action ${String(action)} is not supported for provider ${providerId}.`);
}
