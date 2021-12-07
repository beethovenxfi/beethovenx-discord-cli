import { codeBlock, SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { CommandHandler } from "./index";
import { ethers } from "ethers";

async function execute(interaction: CommandInteraction) {
  const value = interaction.options.getString("value")!;
  const decimals = interaction.options.getNumber("decimals") ?? 18;

  const formattedValue = ethers.utils.formatUnits(value, decimals);

  await interaction.reply({
    content: codeBlock(
      `
      Formatted value: ${formattedValue}
      `
    ),
    ephemeral: true,
  });
}

export const bigNumberTo: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("big_number_to")
    .setDescription("Format big number from big numberish (hex/number)")
    .addStringOption((option) =>
      option
        .setName("value")
        .setDescription("Big numberish value (hex/number)")
        .setRequired(true)
    )
    .addNumberOption((option) =>
      option.setName("decimals").setDescription("Number of decimals")
    ),
  execute,
};
