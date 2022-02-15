import { codeBlock, SlashCommandBuilder } from "@discordjs/builders";
import { ethers } from "hardhat";
import { CommandInteraction } from "discord.js";
import { CommandHandler } from "./index";
import { networkConfig } from "../config/config";
import { MasterChefRewarderFactory } from "../../masterchef-types/MasterChefRewarderFactory";

async function execute(interaction: CommandInteraction) {
  const factory = (await ethers.getContractAt(
    "MasterChefRewarderFactory",
    networkConfig.contractAddresses.MasterChefRewarderFactory
  )) as MasterChefRewarderFactory;

  const deploymentId = interaction.options.getNumber("deployment_id")!;

  const config = await factory.rewarderConfigs(deploymentId);
  const rewarderAddress = await factory.deployedRewarders(deploymentId);
  const output = `
    Rewarder: ${rewarderAddress}
    LP: ${config.lpToken} 
    Reward Token: ${config.rewardToken}
    Rewards/sec: ${config.rewardsPerSecond}
    Admin: ${config.admin}
    Approved: ${config.approved}
    TimelockEta: ${config.timelockEta}
    Activated: ${config.activated}
  `;

  await interaction.reply({ content: codeBlock(output), ephemeral: true });
}

export const rewarderFactoryDeployment: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("rewarder_factory_deployment")
    .setDescription("List rewarder config for deployment ID")
    .addNumberOption((option) =>
      option
        .setName("deployment_id")
        .setDescription("Deployment ID of rewarder")
        .setRequired(true)
    ),
  execute,
};
