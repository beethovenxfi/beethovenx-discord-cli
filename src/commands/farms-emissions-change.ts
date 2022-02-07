import { codeBlock, SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { CommandHandler } from "./index";
import { queueTimelockTransaction } from "../timelock/timelock-transactions";
import moment from "moment";
import { MODERATOR_ROLE, networkConfig } from "../config/config";
import { bn } from "../utils";

async function execute(interaction: CommandInteraction) {
  const beetsPerBlockInput = interaction.options.getString("beets_per_block");
  const decimals = interaction.options.getNumber("decimals")!;

  const beetsPerBlock = bn(beetsPerBlockInput, decimals);

  const eta =
    interaction.options.getNumber("eta") ??
    moment()
      .add(8 * 60, "minutes")
      .unix();

  const contractInteraction = await queueTimelockTransaction({
    targetContract: {
      name: "BeethovenxMasterChef",
      address: networkConfig.contractAddresses.MasterChef,
    },
    value: 0,
    targetFunction: {
      identifier: "updateEmissionRate",
      args: [beetsPerBlock],
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
      Timelock Address: ${contractInteraction.operatorAddress}
      HexData: ${contractInteraction.hexData}`
    ),
    ephemeral: true,
  });
}

export const farmsEmissionsChange: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("farms_emission_change")
    .setDescription(
      "Generate hex data to queue farm emission change on timelock"
    )
    .addStringOption((option) =>
      option
        .setName("beets_per_block")
        .setDescription("BEETS emitted per block")
        .setRequired(true)
    )
    .addNumberOption((option) =>
      option.setName("decimals").setDescription("Decimals").setRequired(true)
    )
    .addNumberOption((option) =>
      option.setName("eta").setDescription("Time of execution (defaults to 8h)")
    )
    .setDefaultPermission(false),
  execute,
  permissionRoles: [MODERATOR_ROLE],
};
