import { inlineCode, SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { CommandHandler } from "./index";
import { deleteTransaction } from "../timelock/timelock-transactions";

async function execute(interaction: CommandInteraction) {
  const transactionId = interaction.options.getString("transaction_id");
  await deleteTransaction(transactionId!);

  await interaction.reply(
    inlineCode(`Transaction with ID ${transactionId} deleted`)
  );
}

export const timelockDelete: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("timelock_delete")
    .setDescription("Delete stored transaction entry")
    .addStringOption((option) =>
      option
        .setName("transaction_id")
        .setDescription("Transaction ID")
        .setRequired(true)
    ),
  execute,
};
