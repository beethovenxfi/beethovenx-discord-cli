import { codeBlock, SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { CommandHandler } from "./index";
import { queueTimelockTransaction } from "../timelock/timelock-transactions";
import moment from "moment";
import { MODERATOR_ROLE, networkConfig } from "../config/config";
import { ethers } from "hardhat";
import { MasterChefOperator } from "../../masterchef-types/MasterChefOperator";
import { splitString } from "../utils";

async function execute(interaction: CommandInteraction) {
  const eta = interaction.options.getNumber("eta")!;

  const operator = (await ethers.getContractAt(
    "MasterChefOperator",
    networkConfig.contractAddresses.MasterChefOperator
  )) as MasterChefOperator;

  const farmAdditions = await operator.farmAdditionsForEta(eta);
  const farmModifications = await operator.farmModificationsForEta(eta);

  const newFarmsSummary = splitString(
    farmAdditions
      .map(
        (addition) =>
          `[ADD] - BPT: ${addition.lpToken} - alloc: ${
            addition.allocationPoints
          }${
            addition.rewarder !== ethers.constants.AddressZero
              ? ` - rewarder: ${addition.rewarder}`
              : ""
          }`
      )
      .join("\n")
  );
  const editFarmsSummary = splitString(
    farmModifications
      .map(
        (modification) =>
          `[EDIT] - pid: ${modification.pid} - alloc: ${
            modification.allocationPoints
          }${
            modification.overwriteRewarder
              ? ` - rewarder: ${modification.rewarder}`
              : ""
          }`
      )
      .join("\n")
  );
  await interaction.reply({
    content: codeBlock(
      `
      Total new farms: ${farmAdditions.length}
      Total edited farms: ${farmModifications.length}
      `
    ),
    ephemeral: true,
  });

  if (farmAdditions.length > 0) {
    for (let split of newFarmsSummary) {
      await interaction.followUp({
        content: codeBlock(split),
        ephemeral: true,
      });
    }
  }

  if (farmModifications.length > 0) {
    for (let split of editFarmsSummary) {
      await interaction.followUp({
        content: codeBlock(split),
        ephemeral: true,
      });
    }
  }
}

export const farmsChangesForEta: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("farms_changes_for_eta")
    .setDescription("Display stages farm changes for specified eta")
    .addNumberOption((option) =>
      option
        .setName("eta")
        .setDescription("Time of execution")
        .setRequired(true)
    ),
  execute,
};
