import moment from 'moment';
import { ChannelId, sendMessage } from '../interactions/send-message';
import axios from 'axios';
import { inlineCode } from '@discordjs/builders';
import snapshot from '@snapshot-labs/snapshot.js';
import { Wallet } from '@ethersproject/wallet';
import fs from 'fs';
import _ from 'lodash';

const ONE_DAY_IN_SECONDS = 86400;

type response = {
    proposal: string;
    incentivesReceived: number;
    choiceHuman: Record<string, number>;
    choice: Record<string, number>;
};

export async function autoVoteDelegate() {
    console.log('Schedule auto vote with delegate');
    await voteCheck();
    setInterval(voteCheck, 900000);
}

export async function voteCheck() {
    console.log('checking if need to vote');

    const response = await axios.get<{ data: { proposalDeadline: number; totalValue: number }[] }>(
        'https://api.hiddenhand.finance/proposal/beethovenx/',
    );
    // console.log(response.data);

    if (!response.data.data || response.data.data.length === 0) {
        console.log('no data found');
        return;
    }
    //deadline passed, vote finished
    if (response.data.data[0].proposalDeadline < moment().unix()) {
        console.log('no active proposal');
        return;
    }

    // less than two bribes up
    if (response.data.data.filter((bribe) => bribe.totalValue > 0).length < 2) {
        console.log('only one bribe up');
        return;
    }

    const voteEnd = response.data.data[0].proposalDeadline;

    // dont vote before 3 days of closing
    if (voteEnd - moment().unix() > 3 * ONE_DAY_IN_SECONDS) {
        console.log('too early to vote');
        return;
    }

    // between 3 and 2 days left, trigger once every 12 hours
    const fifteenMinutes = 15 * 60;
    if (
        voteEnd - moment().unix() < 3 * ONE_DAY_IN_SECONDS &&
        voteEnd - moment().unix() > 2 * ONE_DAY_IN_SECONDS &&
        moment().unix() - moment().startOf('day').unix() < fifteenMinutes
    ) {
        console.log('between 3 and 2 days left, trigger once every 12 hours');
        await vote();
        return;
    }

    // between 2 and 1 days left, trigger once every 1 hour
    if (
        voteEnd - moment().unix() < 2 * ONE_DAY_IN_SECONDS &&
        voteEnd - moment().unix() > 1 * ONE_DAY_IN_SECONDS &&
        moment().unix() - moment().startOf('hour').unix() < fifteenMinutes
    ) {
        console.log('between 2 and 1 days left, trigger once every 1 hour');
        await vote();
        return;
    }

    // vote every 15mins on the last day
    console.log('vote every 15mins on the last day');
    await vote();
}

async function vote() {
    const voterAddress = '0x641e10Cd6132D3e3FA01bfd65d2e0afCf64b136A';
    const market = 'beets';
    const mdSelection = 'Staked Fantom & Circle Symphony';
    const strategy = 'even';

    const { data } = await axios.post<response>('http://127.0.0.1:5000/vote', {
        walletAddress: voterAddress,
        market: market,
        strategy: strategy,
        md_selection: mdSelection,
    });

    console.log(data.choiceHuman);

    const lastVotes = JSON.parse(fs.readFileSync('./src/crons/latestVotes.json', 'utf-8')) as Record<string, number>;

    let differentVote = false;
    for (const key in data.choiceHuman) {
        const threshold = 5;
        const voteAllocation = lastVotes[key];
        const minValue = voteAllocation - threshold;
        const maxValue = voteAllocation + threshold;

        if (data.choiceHuman[key] >= minValue && data.choiceHuman[key] <= maxValue) {
            console.log('vote within range');
        } else {
            differentVote = true;
        }
    }

    if (!differentVote) {
        console.log('same vote as last time');
        return;
    }

    fs.writeFileSync('./src/crons/latestVotes.json', JSON.stringify(data.choiceHuman));

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

        await sendMessage(
            ChannelId.SERVER_STATUS,
            `Unable to vote with delegate. Please check the logs for more information.`,
        );
    }

    await sendMessage(
        ChannelId.SERVER_STATUS,
        `MD voted with the following incentives received: ${inlineCode(
            data.incentivesReceived.toString(),
        )} and votes: ${inlineCode(JSON.stringify(data.choiceHuman))}`,
    );
}
