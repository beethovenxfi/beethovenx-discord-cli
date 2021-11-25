import { codeBlock, SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { CommandHandler } from "./index";
import { queueTimelockTransaction } from "../timelock/timelock-transactions";
import moment from "moment";
import { config } from "../config/config";

async function execute(interaction: CommandInteraction) {
  const pid = interaction.options.getString("pid");
  const allocationPoints = interaction.options.getNumber("allocation_points");
  let rewarderAddress = interaction.options.getString("rewarder_address");
  let overwriteRewarder = false;

  if (!rewarderAddress) {
    rewarderAddress = "0x0000000000000000000000000000000000000000";
  } else {
    overwriteRewarder = true;
  }

  const eta =
    interaction.options.getNumber("eta") ??
    moment()
      .add(8 * 60, "minutes")
      .unix();

  const contractInteraction = await queueTimelockTransaction({
    targetContract: {
      name: "BeethovenxMasterChef",
      address: config.contractAddresses.MasterChef,
    },
    value: 0,
    targetFunction: {
      identifier: "set",
      args: [pid, allocationPoints, rewarderAddress, overwriteRewarder],
    },
    eta: eta,
  });

  await interaction.reply({
    content: codeBlock(
      `
      Contract: ${contractInteraction.contract}
      Data: ${contractInteraction.data}`
    ),
    ephemeral: true,
  });
}

export const farmsEdit: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("farms_edit")
    .setDescription("Generate hex data to queue editing of a farm on timelock")
    .addStringOption((option) =>
      option.setName("pid").setDescription("Pool ID").setRequired(true)
    )
    .addNumberOption((option) =>
      option
        .setName("allocation_points")
        .setDescription("Allocation points (weight) of the farm")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("rewarder_address")
        .setDescription("Rewarder contract address")
    )
    .addNumberOption((option) =>
      option.setName("eta").setDescription("Time of execution (defaults to 8h)")
    ),
  execute,
};
