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
  const etas = await operator.queuedFarmChangeEtas();

  await interaction.reply({
    content: codeBlock(
      `
      Queue etas: [${etas.map((eta) => eta.toString()).join(", ")}]
      `
    ),
    ephemeral: true,
  });
}

export const farmsChangeEtas: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("farms_change_etas")
    .setDescription("Eta's for queued farm changes"),
  execute,
};
