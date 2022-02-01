import { codeBlock, SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { CommandHandler } from "./index";
import {
  getTimelockTransactions,
  queueTimelockTransaction,
} from "../timelock/timelock-transactions";
import moment from "moment";
import { MODERATOR_ROLE, networkConfig } from "../config/config";

async function execute(interaction: CommandInteraction) {
  const adminAddress = interaction.options.getString("address")!;

  const eta =
    interaction.options.getNumber("eta") ??
    moment()
      .add(8 * 60, "minutes")
      .unix();

  const contractInteraction = await queueTimelockTransaction({
    targetContract: {
      name: "Timelock",
      address: networkConfig.contractAddresses.Timelock,
    },
    value: 0,
    targetFunction: {
      identifier: "setPendingAdmin",
      args: [adminAddress],
    },
    eta: eta,
  });

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
      Timelock Address: ${contractInteraction.timelockAddress}
      HexData: ${contractInteraction.hexData}`
    ),
    ephemeral: true,
  });
}

export const timelockSetPendingAdmin: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("timelock_set_pending_admin")
    .setDescription("Set pending timelock admin")
    .addStringOption((option) =>
      option.setName("address").setDescription("Address of new admin")
    )
    .addNumberOption((option) =>
      option.setName("eta").setDescription("Time of execution (defaults to 8h)")
    ),
  execute,
  permissionRoles: [MODERATOR_ROLE],
};
