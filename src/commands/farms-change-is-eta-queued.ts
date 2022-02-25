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
  const operator = (await ethers.getContractAt(
    "MasterChefOperator",
    networkConfig.contractAddresses.MasterChefOperator
  )) as MasterChefOperator;

  const eta = interaction.options.getNumber("eta")!;

  const queued = await operator.usedFarmChangeEtas(eta);

  await interaction.reply({
    content: codeBlock(
      `Changes for eta ${eta} are ${queued ? "queued" : "NOT queued"}`
    ),
    ephemeral: true,
  });
}

export const farmsChangeEtaQueued: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("farms_change_eta_queued")
    .setDescription("Check if changes for eta have been queued on timelock")
    .addNumberOption((option) =>
      option
        .setName("eta")
        .setDescription("Time of execution")
        .setRequired(true)
    ),
  execute,
};
