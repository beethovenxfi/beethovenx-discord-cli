import { networkConfig } from '../config/config';
import reliquaryBeetsStreamerAbi from '../../abi/ReliquaryBeetsStreamer.json';
import reliquaryAbi from '../../abi/Reliquary.json';
import erc20Abi from '../../abi/ERC20.json';
import BeetsConstantEmissionCurve from '../../abi/BeetsConstantEmissionCurve.json';
import moment from 'moment';
import { ChannelId, sendMessage } from '../interactions/send-message';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import axios from 'axios';
import { BigNumber, ContractTransaction } from 'ethers';
import { inlineCode } from '@discordjs/builders';
import snapshot from '@snapshot-labs/snapshot.js';
import { Wallet } from '@ethersproject/wallet';
const { ethers } = require('hardhat');
import fs from 'fs';
import _ from 'lodash';

// every 15mins
export const intervalMs = 900000;

type response = {
    proposal: string;
    incentivesReceived: number;
    choiceHuman: Record<string, number>;
    choice: Record<string, number>;
};

export async function autoVoteDelegate() {
    console.log('Schedule auto vote with delegate');
    await vote();
    setInterval(vote, intervalMs);
}

export async function vote() {
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

    const lastVotes = fs.readFileSync('./src/crons/latestVotes.json', 'utf-8');

    if (_.isEqual(data.choiceHuman, JSON.parse(lastVotes))) {
        console.log('do not cast the same vote');
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
