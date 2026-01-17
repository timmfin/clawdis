import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClawdbotConfig } from "../../../../config/config.js";
import { handleDiscordMessageAction } from "./handle-action.js";

const handleDiscordActionMock = vi.fn<
  (params: Record<string, unknown>, cfg: ClawdbotConfig) => Promise<AgentToolResult<unknown>>
>();
const fetchChannelInfoDiscordMock = vi.fn();

vi.mock("../../../../agents/tools/discord-actions.js", () => ({
  handleDiscordAction: (params: Record<string, unknown>, cfg: ClawdbotConfig) =>
    handleDiscordActionMock(params, cfg),
}));

vi.mock("../../../../discord/send.js", () => ({
  fetchChannelInfoDiscord: (channelId: string, opts?: unknown) =>
    fetchChannelInfoDiscordMock(channelId, opts),
}));

describe("handleDiscordMessageAction thread isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks thread-delete when thread is not in the current channel", async () => {
    handleDiscordActionMock.mockResolvedValue({ content: [], details: { ok: true } });
    fetchChannelInfoDiscordMock.mockResolvedValue({ parent_id: "222" });

    await expect(
      handleDiscordMessageAction({
        action: "thread-delete",
        params: { threadId: "999" },
        cfg: {} as ClawdbotConfig,
        accountId: "acc1",
        toolContext: { currentChannelId: "111" },
      }),
    ).rejects.toThrow(/refusing to act/i);

    expect(handleDiscordActionMock).not.toHaveBeenCalled();
    expect(fetchChannelInfoDiscordMock).toHaveBeenCalledWith("999", { accountId: "acc1" });
  });

  it("allows thread-rename when thread belongs to the current channel", async () => {
    handleDiscordActionMock.mockResolvedValue({ content: [], details: { ok: true } });
    fetchChannelInfoDiscordMock.mockResolvedValue({ parent_id: "111" });

    await handleDiscordMessageAction({
      action: "thread-rename",
      params: { threadId: "999", threadName: "New name" },
      cfg: {} as ClawdbotConfig,
      accountId: "acc1",
      toolContext: { currentChannelId: "channel:111" },
    });

    expect(fetchChannelInfoDiscordMock).toHaveBeenCalledWith("999", { accountId: "acc1" });
    expect(handleDiscordActionMock).toHaveBeenCalledWith(
      { action: "threadRename", channelId: "999", name: "New name" },
      expect.any(Object),
    );
  });

  it("allows thread-delete without fetching when deleting the current thread", async () => {
    handleDiscordActionMock.mockResolvedValue({ content: [], details: { ok: true } });

    await handleDiscordMessageAction({
      action: "thread-delete",
      params: { threadId: "999" },
      cfg: {} as ClawdbotConfig,
      toolContext: { currentChannelId: "999" },
    });

    expect(fetchChannelInfoDiscordMock).not.toHaveBeenCalled();
    expect(handleDiscordActionMock).toHaveBeenCalledWith(
      { action: "threadDelete", channelId: "999" },
      expect.any(Object),
    );
  });

  it("does not enforce thread parent checks when unbound", async () => {
    handleDiscordActionMock.mockResolvedValue({ content: [], details: { ok: true } });

    await handleDiscordMessageAction({
      action: "thread-delete",
      params: { threadId: "999" },
      cfg: {} as ClawdbotConfig,
    });

    expect(fetchChannelInfoDiscordMock).not.toHaveBeenCalled();
    expect(handleDiscordActionMock).toHaveBeenCalled();
  });
});
