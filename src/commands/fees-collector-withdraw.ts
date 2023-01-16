import { codeBlock, inlineCode, SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { CommandHandler } from './index';
import { MODERATOR_ROLE, networkConfig } from '../config/config';
import { ethers } from 'hardhat';
import { splitString } from '../utils';

async function execute(interaction: CommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const tokensInput = interaction.options.getString('tokens')!;
    const tokens = tokensInput.split(',');
    const recipient = interaction.options.getString('recipient')!;

    const feesCollector = await ethers.getContractAt(
        'ProtocolFeesCollector',
        networkConfig.contractAddresses.ProtocolFeesCollector,
    );

    const amounts = await feesCollector.getCollectedFeeAmounts(tokens);

    let tokenAmounts = '';

    for (let index = 0; index < tokens.length; index++) {
        const erc20 = await ethers.getContractAt('ERC20', tokens[index]);
        tokenAmounts += `${await erc20.symbol()} - ${ethers.utils.formatUnits(amounts[index], await erc20.decimals())}
    `;
    }
    await interaction.editReply({ content: inlineCode('Token amounts:') });
    if (tokenAmounts.length < 2000) {
        await interaction.followUp({
            content: codeBlock(tokenAmounts),
            ephemeral: true,
        });
    } else {
        const splits = splitString(tokenAmounts);
        for (let split of splits) {
            await interaction.followUp({
                content: codeBlock(split),
                ephemeral: true,
            });
        }
    }

    const tokenData = `
    Contract: ${feesCollector.address}
    Data: ${feesCollector.interface.encodeFunctionData('withdrawCollectedFees', [tokens, amounts, recipient])}
  `;

    if (tokenData.length < 2000) {
        await interaction.followUp({
            content: codeBlock(tokenData),
            ephemeral: true,
        });
    } else {
        const splits = splitString(tokenData);
        for (let split of splits) {
            await interaction.followUp({
                content: codeBlock(split),
                ephemeral: true,
            });
        }
    }
}

export const feesCollectorWithdraw: CommandHandler = {
    definition: new SlashCommandBuilder()
        .setName('protocol_fees_withdraw')
        .setDescription('Withdraw collected protocol fees')
        .addStringOption((option) =>
            option.setName('tokens').setDescription('Comma seperated list of token addresses').setRequired(true),
        )
        .addStringOption((option) => option.setName('recipient').setDescription('Recipient address').setRequired(true))
        .setDefaultPermission(false),
    execute,
};
