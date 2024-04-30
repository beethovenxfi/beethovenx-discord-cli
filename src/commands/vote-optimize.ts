import { codeBlock, inlineCode, SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { CommandHandler } from './index';
import axios from 'axios';

type response = {
    proposal: string;
    inventivesReceived: number;
    choiceHuman: Record<string, number>;
    choice: Record<string, number>;
};

async function execute(interaction: CommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const voterAddress = interaction.options.getString('address')!;
    const market = interaction.options.getString('market')!;
    const mdSelection = interaction.options.getString('md_selection')!;

    const { data } = await axios.post<response>('http://127.0.0.1:5000', {
        walletAddress: voterAddress,
        market: market,
        md_selection: mdSelection,
    });

    console.log(data.choiceHuman);

    await interaction.reply({
        content: codeBlock(`
            Inventives received: ${data.inventivesReceived}
            Votes: ${JSON.stringify(data.choiceHuman, null, 2)}
        `),
        ephemeral: true,
    });

    await interaction.editReply({ content: inlineCode('Votes:') });
    await interaction.followUp({
        content: codeBlock(data.choiceHuman.toString()),
        ephemeral: true,
    });
}

export const voteOptimization: CommandHandler = {
    definition: new SlashCommandBuilder()
        .setName('vote_optimizer')
        .setDescription('Optimizes votes for a given address and market')
        .addStringOption((option) =>
            option.setName('address').setDescription('The wallet address to optimize').setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('market')
                .addChoices({ name: 'Beethoven X', value: 'beets' })
                .setDescription('Recipient address')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('md_selection')
                .setDescription('Music Director selection for specified of the VP. Full pool name.')
                .setRequired(false),
        )
        .setDefaultPermission(false),
    execute,
};
