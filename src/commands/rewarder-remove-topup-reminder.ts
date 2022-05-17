import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import fs from "fs";
import path from "path";
import { MODERATOR_ROLE } from "../config/config";
import { CommandHandler } from "./index";

async function execute(interaction: CommandInteraction) {
  const rewarderAddress = interaction.options.getString("rewarder_address")!;

  let rewarders: string[] = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, `../../.rewarder/rewarder-list.json`),
      "utf-8"
    )
  );

  rewarders = rewarders.filter((rewarder) => rewarder !== rewarderAddress);

  fs.writeFileSync(
    path.join(__dirname, `../../.rewarder/rewarder-list.json`),
    JSON.stringify([...new Set(rewarders)])
  );

  await interaction.reply({ content: "done!", ephemeral: true });
}

export const rewarderRemoveTopUpReminder: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("rewarder_remove_top_up_reminder")
    .setDescription("Remove top up reminder for rewarder")
    .addStringOption((option) =>
      option
        .setName("rewarder_address")
        .setDescription("Address of rewarder")
        .setRequired(true)
    )
    .setDefaultPermission(false),
  execute,
};
