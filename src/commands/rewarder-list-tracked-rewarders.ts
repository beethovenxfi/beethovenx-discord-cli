import { SlashCommandBuilder, inlineCode } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { codeBlock } from '@discordjs/builders';
import fs from 'fs';
import path from 'path';
import { MODERATOR_ROLE } from '../config/config';
import { CommandHandler } from './index';
import { ERC20, RewarderMock } from '../../masterchef-types';
import { ethers } from 'hardhat';
import { TimeBasedMasterChefRewarder } from '../../masterchef-types/TimeBasedMasterChefRewarder';
import moment from 'moment';
import { TimeBasedMasterChefMultiTokenRewarder } from '../../masterchef-types/TimeBasedMasterChefMultiTokenRewarder';
import { sendMessage, ChannelId } from '../interactions/send-message';

type RewarderOutput = {
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

    let rewardersOut: RewarderOutput[] = [];
    for (const rewarderAddress of rewarders) {
        if (!ethers.utils.isAddress(rewarderAddress)) {
            continue;
        }

        let rewarder: RewarderOutput;

        try {
            rewarder = await getSingleTokenRewarder(rewarderAddress);
        } catch (e) {
            // check if it's a multitoken rewarder
            console.log(`SingleTokenRewarder check failed: ${rewarderAddress}`);
            try {
                rewarder = await getMultiTokenRewarder(rewarderAddress);
            } catch (e) {
                console.log('error checking for empty rewarders', e);
                continue;
            }
        }

        rewardersOut.push(rewarder);

        await interaction.editReply({
            content: codeBlock(`Found ${rewardersOut.length} rewarders:`),
        });
        for (const rewarder of rewardersOut) {
            await interaction.followUp({
                content: codeBlock(`${JSON.stringify(rewarder, null, 2)}`),
                ephemeral: true,
            });
        }
    }
}

async function getSingleTokenRewarder(rewarderAddress: string): Promise<RewarderOutput> {
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

    return {
        address: rewarderAddress,
        rewardTokenAddress: rewardTokenAddress,
        rewardTokenBalance: rewardTokenBalance.toString(),
        rewardsPerSecond: rewardPerSecond.toString(),
        rewardTokenSymbol: rewardTokenSymbol,
        masterchefFarmId: masterchefFarmId.toString(),
    };
}

async function getMultiTokenRewarder(rewarderAddress: string): Promise<RewarderOutput> {
    const rewarder = (await ethers.getContractAt(
        'TimeBasedMasterChefMultiTokenRewarder',
        rewarderAddress,
    )) as TimeBasedMasterChefMultiTokenRewarder;

    const masterchefFarmId = await rewarder.masterchefPoolIds(0);

    const rewarderOutputs: RewarderOutput[] = [];

    const rewardTokens = await rewarder.getRewardTokens();
    let i = 0;
    for (const rewardToken of rewardTokens) {
        const erc20 = (await ethers.getContractAt('ERC20', rewardToken)) as ERC20;
        const balance = await erc20.balanceOf(rewarder.address);
        const rewardTokenConfig = await rewarder.rewardTokenConfigs(i);

        const rewardTokenSymbol = await erc20.symbol();

        rewarderOutputs.push({
            address: rewarderAddress,
            masterchefFarmId: masterchefFarmId.toString(),
            rewardsPerSecond: rewardTokenConfig.rewardsPerSecond.toString(),
            rewardTokenAddress: rewardToken,
            rewardTokenBalance: balance.toString(),
            rewardTokenSymbol: rewardTokenSymbol,
        });
    }
    return {
        address: rewarderAddress,
        masterchefFarmId: masterchefFarmId.toString(),
        rewardTokenAddress: rewarderOutputs.map((tokens) => tokens.rewardTokenAddress).join(','),
        rewardTokenBalance: rewarderOutputs.map((tokens) => tokens.rewardTokenBalance).join(','),
        rewardsPerSecond: rewarderOutputs.map((tokens) => tokens.rewardsPerSecond).join(','),
        rewardTokenSymbol: rewarderOutputs.map((tokens) => tokens.rewardTokenSymbol).join(','),
    };
}

export const rewarderListTracked: CommandHandler = {
    definition: new SlashCommandBuilder().setName('rewarder_list_tracked').setDescription('List all tracked rewarders'),
    execute,
};
