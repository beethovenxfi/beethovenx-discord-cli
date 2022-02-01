import { codeBlock, SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { CommandHandler } from "./index";
import { ethers } from "ethers";

async function execute(interaction: CommandInteraction) {
  const types = interaction.options.getString("types")!.split(",");
  const values = interaction.options.getString("values")!.split(",");

  const abi = new ethers.utils.AbiCoder();

  await interaction.reply({
    content: codeBlock(
      `
      abi: ${abi.encode(types, values)}
      `
    ),
    ephemeral: true,
  });
}

export const abiEncode: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("abi_encode")
    .setDescription("abi encode arguments")
    .addStringOption((option) =>
      option
        .setName("types")
        .setDescription("comma seperated list of types")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("values")
        .setDescription("comma seperated list of values")
        .setRequired(true)
    ),
  execute,
};
