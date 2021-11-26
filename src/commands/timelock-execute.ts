import { codeBlock, SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { CommandHandler } from "./index";
import { executeTimelockTransaction } from "../timelock/timelock-transactions";
import moment from "moment";

async function execute(interaction: CommandInteraction) {
  const transactionId = interaction.options.getString("transaction_id");
  const contractInteraction = await executeTimelockTransaction(transactionId!);

  await interaction.reply({
    content: codeBlock(
      `
      TX_ID: ${contractInteraction.transactionId}
      Contract name: ${contractInteraction.targetContract.name}
      Contract address: ${contractInteraction.targetContract.address},
      Function: ${
        contractInteraction.targetFunction.identifier
      }(${contractInteraction.targetFunction.args.join(",")})
      eta: ${moment.unix(contractInteraction.eta)}
      HexData: ${contractInteraction.hexData}`
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
