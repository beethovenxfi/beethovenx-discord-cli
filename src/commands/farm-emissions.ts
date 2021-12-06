import { codeBlock, SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { CommandHandler } from "./index";
import { queueTimelockTransaction } from "../timelock/timelock-transactions";
import moment from "moment";
import { networkConfig } from "../config/config";
import { ethers } from "hardhat";
import { BeethovenxMasterChef, BeethovenxToken } from "../../masterchef-types";
import { bn } from "../utils";
import emissionSchedule from "./emission-schedule.json";

const initialMintedBeets = bn(5_000_000 + 32_500_000 + 17_500_000);

async function execute(interaction: CommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const token = (await ethers.getContractAt(
    "BeethovenxToken",
    networkConfig.contractAddresses.BeethovenxToken
  )) as BeethovenxToken;

  const chef = (await ethers.getContractAt(
    "BeethovenxMasterChef",
    networkConfig.contractAddresses.MasterChef
  )) as BeethovenxMasterChef;

  const totalSupply = await token.totalSupply();
  const beetsPerBlock = await chef.beetsPerBlock();

  const emittedBeets = totalSupply.sub(initialMintedBeets);

  let emissionStep = 0;
  while (
    emissionStep < emissionSchedule.length &&
    bn(emissionSchedule[emissionStep].total_emitted).lte(emittedBeets)
  ) {
    emissionStep++;
  }

  const emissionScheduleStepInfo = emissionSchedule[emissionStep];
  const normalizedEmittedBeets = parseInt(
    ethers.utils.formatUnits(emittedBeets)
  ).toFixed(0);

  await interaction.editReply({
    content: codeBlock(
      `
      Total emitted BEETS: ${normalizedEmittedBeets}
      Current BEETS per block: ${ethers.utils.formatUnits(beetsPerBlock)} 
      Expected BEETS per block: ${
        emissionScheduleStepInfo.beets_per_block / 100
      } (step ${emissionStep + 1})
      ${
        bn(emissionScheduleStepInfo.beets_per_block, 16).eq(beetsPerBlock)
          ? `No emission change required until ${
              emissionScheduleStepInfo.total_emitted
            } emitted BEETS!
      Remaining BEETS emission until change: ${
        emissionScheduleStepInfo.total_emitted -
        parseInt(normalizedEmittedBeets)
      }`
          : `Please change emission rate to ${
              emissionScheduleStepInfo.beets_per_block / 100
            }!`
      }
      `
    ),
  });
}

export const farmEmissions: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("farms_emissions")
    .setDescription("View emission infos"),
  execute,
};
