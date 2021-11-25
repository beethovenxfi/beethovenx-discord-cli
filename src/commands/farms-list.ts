import { codeBlock, SlashCommandBuilder } from "@discordjs/builders";
import { ethers } from "hardhat";
import { CommandInteraction } from "discord.js";
import { CommandHandler } from "./index";
import { config } from "../config/config";
import { BeethovenxMasterChef } from "../../types";

async function execute(interaction: CommandInteraction) {
  const chef = (await ethers.getContractAt(
    "BeethovenxMasterChef",
    config.contractAddresses.MasterChef
  )) as BeethovenxMasterChef;
  await interaction.deferReply({ ephemeral: true });
  const poolsLength = await chef.poolLength();

  let output = `Total pools: ${poolsLength}\n`;

  for (let pid = 0; pid < poolsLength.toNumber(); pid++) {
    const { allocPoint, accBeetsPerShare, lastRewardBlock } =
      await chef.poolInfo(pid);
    const lpTokenAddess = await chef.lpTokens(pid);
    output += `PID: ${pid} - LpAddr: ${lpTokenAddess} - allc: ${allocPoint.toString()}\n`;
  }
  await interaction.editReply({ content: codeBlock(output) });
}

export const farmsList: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("farms_list")
    .setDescription("List all masterchef farms"),
  execute,
};
