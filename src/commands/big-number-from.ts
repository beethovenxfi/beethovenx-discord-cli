import { codeBlock, SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { CommandHandler } from './index';
import { parseUnits } from 'ethers/lib/utils';

async function execute(interaction: CommandInteraction) {
    const value = interaction.options.getString('value')!;
    const decimals = interaction.options.getNumber('decimals') ?? 18;

    const bigNumberValue = parseUnits(value, decimals);

    await interaction.reply({
        content: codeBlock(
            `
      Number value: ${bigNumberValue.toString()}
      Hex value: ${bigNumberValue.toHexString()}
      `,
        ),
        ephemeral: true,
    });
}

export const bigNumberFrom: CommandHandler = {
    definition: new SlashCommandBuilder()
        .setName('big_number_from')
        .setDescription('Create big number from big numberish (hex/number)')
        .addStringOption((option) =>
            option.setName('value').setDescription('Big numberish value (hex/number)').setRequired(true),
        )
        .addNumberOption((option) => option.setName('decimals').setDescription('Number of decimals')),
    execute,
};
