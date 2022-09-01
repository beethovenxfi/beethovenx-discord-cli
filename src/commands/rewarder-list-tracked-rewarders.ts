import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { codeBlock } from '@discordjs/builders';
import fs from 'fs';
import path from 'path';
import { MODERATOR_ROLE } from '../config/config';
import { CommandHandler } from './index';
import { ERC20, RewarderMock } from '../../masterchef-types';
import { ethers } from 'hardhat';
import { TimeBasedMasterChefRewarder } from '../../masterchef-types/TimeBasedMasterChefRewarder';

type rewarderOutput = {
    address: string;
    rewardTokenAddress: string;
    rewardTokenSymbol: string;
    rewardTokenBalance: string;
    rewardsPerSecond: string;
    masterchefFarmId: string;
};

async function execute(interaction: CommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    let rewarders: string[] = JSON.parse(
        fs.readFileSync(path.join(__dirname, `../../.rewarder/rewarder-list.json`), 'utf-8'),
    );

    let rewardersOut: rewarderOutput[] = [];
    for (const rewarderAddress of rewarders) {
        if (!ethers.utils.isAddress(rewarderAddress)) {
            continue;
        }
        const rewarder = (await ethers.getContractAt(
            'TimeBasedMasterChefRewarder',
            rewarderAddress,
        )) as unknown as TimeBasedMasterChefRewarder;
        const masterchefFarmId = await rewarder.masterchefPoolIds(0);

        const rewardTokenAddress = await rewarder.rewardToken();
        const rewardToken = (await ethers.getContractAt('ERC20', rewardTokenAddress)) as unknown as ERC20;
        const rewardTokenSymbol = await rewardToken.symbol();

        const rewardTokenBalance = await rewardToken.balanceOf(rewarderAddress);
        const rewardPerSecond = await rewarder.rewardPerSecond();

        rewardersOut.push({
            address: rewarderAddress,
            rewardTokenAddress: rewardTokenAddress,
            rewardTokenBalance: rewardTokenBalance.toString(),
            rewardsPerSecond: rewardPerSecond.toString(),
            rewardTokenSymbol: rewardTokenSymbol,
            masterchefFarmId: masterchefFarmId.toString(),
        });
    }
    await interaction.reply({
        content: codeBlock(`All tracked rewarders:`),
        ephemeral: true,
    });
    for (const rewarder of rewardersOut) {
        await interaction.followUp({
            content: codeBlock(`${JSON.stringify(rewarder, null, 2)}`),
            ephemeral: true,
        });
    }
}

export const rewarderListTracked: CommandHandler = {
    definition: new SlashCommandBuilder().setName('rewarder_list_tracked').setDescription('List all tracked rewarders'),
    execute,
};
