import { codeBlock, SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { CommandHandler } from './index';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { networkConfig } from '../config/config';
const { ethers } = require('hardhat');
import erc20Abi from '../../abi/ERC20.json';
import reliquaryAbi from '../../abi/Reliquary.json';
import BeetsConstantEmissionCurve from '../../abi/BeetsConstantEmissionCurve.json';
import reliquaryBeetsStreamerAbi from '../../abi/ReliquaryBeetsStreamer.json';
import { intervalMs, triggerDuration } from '../crons/stream_beets_reliquary';

import { BigNumber } from 'ethers';
import axios from 'axios';
import moment from 'moment';

const reliquarySubgraphUrl: string = 'https://api.thegraph.com/subgraphs/name/beethovenxfi/reliquary';
const fBeetsPoolId: number = 1;

async function execute(interaction: CommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    //TODO change to real beets
    const beets = await ethers.getContractAt(erc20Abi, networkConfig.contractAddresses.BeethovenxToken);
    const reliquary = await ethers.getContractAt(reliquaryAbi, networkConfig.contractAddresses.Reliquary);
    const curveAddress = await reliquary.emissionCurve();
    const curve = await ethers.getContractAt(BeetsConstantEmissionCurve, curveAddress);
    const reliquaryStreamer = await ethers.getContractAt(
        reliquaryBeetsStreamerAbi,
        networkConfig.contractAddresses.ReliquaryBeetsStreamer,
    );

    const beetsLeftOnReliquary = (await beets.balanceOf(networkConfig.contractAddresses.Reliquary)) as BigNumber;
    const currentRate = (await curve.getRate(0)) as BigNumber;

    // calculate remaining beets
    const allRelics = await axios.post<{
        data: { relics: [{ relicId: number }] };
    }>(reliquarySubgraphUrl, {
        query: `{   
            relics(where: {pid: ${fBeetsPoolId}}) {
                relicId
            }
            }`,
    });
    let totalPendingRewards = BigNumber.from(0);
    for (const relic of allRelics.data.data.relics) {
        let pendingReward = (await reliquary.pendingReward(relic.relicId)) as BigNumber;
        totalPendingRewards = totalPendingRewards.add(pendingReward);
    }

    // check when we run out
    const totalBeetsAvailable = beetsLeftOnReliquary.sub(totalPendingRewards);
    const secondsOfBeetsLeft = totalBeetsAvailable.div(currentRate);
    const runOutDate = moment().add(secondsOfBeetsLeft.toNumber(), 'seconds');
    const lastTransferTimestamp = (await reliquaryStreamer.lastTransferTimestamp()) as BigNumber;

    // adjust epoch end for cron interval, could be triggered up to interval after
    const epochEnd = moment.unix(lastTransferTimestamp.toNumber() + triggerDuration + intervalMs / 1000);
    const secondsInEpochLeft = epochEnd.unix() - moment().unix();

    const beetsNeeded = currentRate.mul(`${secondsInEpochLeft}`);
    const beetsDifferenceForEpoch = totalBeetsAvailable.sub(beetsNeeded);

    // spread the total beets available to what the bot trigger duration is
    const proposedEmissionRate = totalBeetsAvailable.div(triggerDuration);

    let beetsAlarm = '';
    if (totalBeetsAvailable.lt(`0`)) {
        beetsAlarm = `ATTENTION: The reliquary ran out of beets. It is lacking  ${formatUnits(
            totalBeetsAvailable,
        )} BEETS.`;
    }

    if (beetsDifferenceForEpoch.lt(`0`)) {
        await interaction.editReply({
            content: codeBlock(
                `${beetsAlarm}
Beets available: ${formatUnits(totalBeetsAvailable)}
Current rate: ${formatUnits(currentRate)} BEETS/s
Depleted on: ${runOutDate.format()} 
New epoch start: ${epochEnd.format()}. 
Proposed emission rate change for BEETS to last until the end of the epoch: ${formatUnits(
                    proposedEmissionRate,
                )} (${proposedEmissionRate}) 
Or send ${formatUnits(beetsNeeded.sub(totalBeetsAvailable))} (${beetsNeeded.sub(
                    totalBeetsAvailable,
                )}) beets to reliquary.`,
            ),
        });
    } else {
        await interaction.editReply({
            content: codeBlock(
                `ATTENTION: Reliquary will run out of BEETS this epoch:
${beetsAlarm}
Beets available: ${formatUnits(totalBeetsAvailable)}
Current rate: ${formatUnits(currentRate)} BEETS/s 
Depleted on: ${runOutDate.format()} 
New epoch start: ${epochEnd.format()} 
Surplus of ${formatUnits(beetsDifferenceForEpoch)} BEETS. 
Proposed emission rate change to use all available BEETS: ${formatUnits(
                    proposedEmissionRate,
                )} (${proposedEmissionRate})`,
            ),
        });
    }
}

export const checkReliquaryRate: CommandHandler = {
    definition: new SlashCommandBuilder()
        .setName('check_reliquary_rate')
        .setDescription('Check the emission rate on reliquary and propose a better rate based on avaliable Beets.'),
    execute,
};
