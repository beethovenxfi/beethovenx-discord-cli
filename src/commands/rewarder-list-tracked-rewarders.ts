import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { codeBlock } from "@discordjs/builders";
import fs from "fs";
import path from "path";
import { MODERATOR_ROLE } from "../config/config";
import { CommandHandler } from "./index";

async function execute(interaction: CommandInteraction) {
  let rewarders: string[] = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, `../../.rewarder/rewarder-list.json`),
      "utf-8"
    )
  );

  await interaction.reply({
    content: codeBlock(`[${rewarders.join(", ")}]`),
    ephemeral: true,
  });
}

export const rewarderListTracked: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("rewarder_list_tracked")
    .setDescription("List all tracked rewarders"),
  execute,
  permissionRoles: [MODERATOR_ROLE],
};
