import { codeBlock, SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { CommandHandler } from "./index";
import { ethers } from "ethers";

async function execute(interaction: CommandInteraction) {
  const value = interaction.options.getString("value")!;

  const formattedValue = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(value)
  );

  await interaction.reply({
    content: codeBlock(
      `
      Keccak256: ${formattedValue}
      `
    ),
    ephemeral: true,
  });
}

export const keccak256: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("keccak256")
    .setDescription("hash function")
    .addStringOption((option) =>
      option.setName("value").setDescription("Input").setRequired(true)
    )
    .addNumberOption((option) =>
      option.setName("decimals").setDescription("Number of decimals")
    ),
  execute,
};
