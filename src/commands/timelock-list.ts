import { codeBlock, SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { CommandHandler } from "./index";
import {
  executeTimelockTransaction,
  getTimelockTransactions,
} from "../timelock/timelock-transactions";
import moment from "moment";

async function execute(interaction: CommandInteraction) {
  const onlyExecutable = interaction.options.getBoolean("executable_only")!;

  const timelockTransactions = getTimelockTransactions(onlyExecutable);
  let output = "";
  for (let timelockTransaction of timelockTransactions) {
    output += `
    TX_ID: ${timelockTransaction.id}
    contract: ${timelockTransaction.transaction.targetContract.name} - [${
      timelockTransaction.transaction.targetContract.address
    }]
    func: ${timelockTransaction.transaction.targetFunction.identifier}
    args: [${timelockTransaction.transaction.targetFunction.args.join(",")}]
    eta: ${moment.unix(timelockTransaction.transaction.eta)}
    -------------------------------------------------`;
  }
  await interaction.reply({ content: codeBlock(output), ephemeral: true });
}

export const timelockList: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("timelock_list")
    .setDescription("List transactions ready to execute")
    .addBooleanOption((option) =>
      option
        .setName("executable_only")
        .setDescription("Show only executable transactions")
        .setRequired(true)
    ),

  execute,
};
