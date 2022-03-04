import {
  codeBlock,
  inlineCode,
  SlashCommandBuilder,
} from "@discordjs/builders";
import { ethers } from "hardhat";
import { CommandInteraction } from "discord.js";
import { CommandHandler } from "./index";
import { networkConfig } from "../config/config";
import { MasterChefRewarderFactory } from "../../masterchef-types/MasterChefRewarderFactory";
import fs from "fs";
import path from "path";
import { TimeBasedMasterChefRewarder } from "../../masterchef-types/TimeBasedMasterChefRewarder";
import { ERC20 } from "../../masterchef-types";
import moment from "moment";
import { ChannelId, sendMessage } from "../interactions/send-message";

async function execute(interaction: CommandInteraction) {
  const rewarderAddress = interaction.options.getString("rewarder_address")!;

  const rewarder = (await ethers.getContractAt(
    "TimeBasedMasterChefRewarder",
    rewarderAddress
  )) as TimeBasedMasterChefRewarder;

  const rewardToken = await rewarder.rewardToken();
  const erc20 = (await ethers.getContractAt("ERC20", rewardToken)) as ERC20;
  const balance = await erc20.balanceOf(rewarder.address);
  const rewardPerSecond = await rewarder.rewardPerSecond();

  const seconds = balance.div(rewardPerSecond);
  const estimatedEndOfRewards = moment().add(seconds.toNumber());
  await interaction.reply({
    content: codeBlock(`
        Reward token: ${await erc20.name()} - ${rewardToken}
        Remaining rewards: ${ethers.utils.formatUnits(
          balance
        )} [${await erc20.symbol()}
        Estimated end of rewards: ${estimatedEndOfRewards.toISOString()} 
    `),
    ephemeral: true,
  });
}

export const rewarderStats: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("rewarder_stats")
    .setDescription("Show rewarder stats")
    .addStringOption((option) =>
      option
        .setName("rewarder_address")
        .setDescription("Address of rewarder")
        .setRequired(true)
    ),
  execute,
};
