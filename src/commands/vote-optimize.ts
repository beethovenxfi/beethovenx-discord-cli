import { codeBlock, inlineCode, SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { CommandHandler } from './index';
import axios from 'axios';
import snapshot from '@snapshot-labs/snapshot.js';
import { Wallet } from '@ethersproject/wallet';

type response = {
    proposal: string;
    incentivesReceived: number;
    choiceHuman: Record<string, number>;
    choice: Record<string, number>;
};

async function execute(interaction: CommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const voterAddress = interaction.options.getString('address')!;
    const market = interaction.options.getString('market')!;
    const mdSelection = interaction.options.getString('md_selection')!;
    const strategy = interaction.options.getString('strategy')!;
    const vote = interaction.options.getString('auto_vote')!;

    const { data } = await axios.post<response>('http://127.0.0.1:5000/vote', {
        walletAddress: voterAddress,
        market: market,
        strategy: strategy,
        md_selection: mdSelection,
    });

    console.log(data.choiceHuman);

    if (vote === 'true') {
        const client = new snapshot.Client712('https://hub.snapshot.org');

        const provider = snapshot.utils.getProvider('250');

        let wallet = new Wallet(process.env.MD_DELEGATE!);
        wallet = wallet.connect(provider);

        console.log(wallet.address);

        try {
            const receipt = await client.vote(wallet, wallet.address, {
                space: 'beets.eth',
                proposal: data.proposal,
                type: 'weighted',
                choice: data.choice,
                app: 'script',
            });
            console.log(receipt);
        } catch (error) {
            console.log(error);
        }
    }

    await interaction.followUp({
        content: codeBlock(`
            Incentives received: ${data.incentivesReceived}
            Votes: ${JSON.stringify(data.choiceHuman, null, 2)}
        `),
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
                .setName('strategy')
                .addChoices({ name: 'max ROI', value: 'roi' }, { name: 'even market', value: 'even' })
                .setDescription('Optimize either for maximum return or even market.')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('auto_vote')
                .addChoices({ name: 'yes', value: 'true' }, { name: 'no', value: 'false' })
                .setDescription('Whether to automatically cast the vote on snapshot.')
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
