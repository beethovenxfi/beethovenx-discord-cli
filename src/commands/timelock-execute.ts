import { codeBlock, SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { CommandHandler } from "./index";
import { executeTimelockTransaction } from "../timelock/timelock-transactions";

async function execute(interaction: CommandInteraction) {
  const transactionId = interaction.options.getString("transaction_id");
  const contractInteraction = await executeTimelockTransaction(transactionId!);

  await interaction.reply({
    content: codeBlock(
      `
      Contract: ${contractInteraction.contract}
      Data: ${contractInteraction.data}`
    ),
    ephemeral: true,
  });
}

export const timelockExecute: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("timelock_execute")
    .setDescription("Execute queued timelock transaction")
    .addStringOption((option) =>
      option
        .setName("transaction_id")
        .setDescription("Transaction ID")
        .setRequired(true)
    ),
  execute,
};
