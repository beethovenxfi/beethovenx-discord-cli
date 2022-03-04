import { codeBlock, SlashCommandBuilder } from "@discordjs/builders";
import { ethers } from "hardhat";
import { CommandInteraction } from "discord.js";
import { CommandHandler } from "./index";
import { MODERATOR_ROLE, networkConfig } from "../config/config";
import { MasterChefRewarderFactory } from "../../masterchef-types/MasterChefRewarderFactory";
import fs from "fs";
import path from "path";

async function execute(interaction: CommandInteraction) {
  const rewarderAddress = interaction.options.getString("rewarder_address")!;

  const rewarders: string[] = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, `../../.rewarder/rewarder-list.json`),
      "utf-8"
    )
  );

  rewarders.push(rewarderAddress);

  fs.writeFileSync(
    path.join(__dirname, `../../.rewarder/rewarder-list.json`),
    JSON.stringify([...new Set(rewarders)])
  );

  await interaction.reply({ content: "done!", ephemeral: true });
}

export const rewarderAddTopUpReminder: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("rewarder_add_top_up_reminder")
    .setDescription("List rewarder config for deployment ID")
    .addStringOption((option) =>
      option
        .setName("rewarder_address")
        .setDescription("Address of rewarder")
        .setRequired(true)
    )
    .setDefaultPermission(false),
  execute,
  permissionRoles: [MODERATOR_ROLE],
};
