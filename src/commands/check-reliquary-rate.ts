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
import { triggerDuration } from '../crons/stream_beets_reliquary';

import { BigNumber } from 'ethers';
import axios from 'axios';
import moment from 'moment';

const reliquarySubgraphUrl: string = 'https://api.thegraph.com/subgraphs/name/beethovenxfi/reliquary';

async function execute(interaction: CommandInteraction) {
    //TODO change to real beets
    const beets = await ethers.getContractAt(erc20Abi, networkConfig.contractAddresses.TestBeethovenxToken);
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
                        relics{
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
    const secondsOfBeets = totalBeetsAvailable.div(currentRate);
    const runOutDate = moment().add(formatUnits(secondsOfBeets), 'seconds');
    const lastTransferTimestamp = (await reliquaryStreamer.lastTransferTimestamp()) as BigNumber;

    // spread the total beets available to 7 days
    const proposedEmissionRate = totalBeetsAvailable.div(
        moment.unix(lastTransferTimestamp.toNumber()).add(7, 'days').unix() - moment().unix(),
    );
    if (runOutDate.unix() < lastTransferTimestamp.toNumber() + triggerDuration) {
        await interaction.reply({
            content: codeBlock(
                `There are now ${formatUnits(
                    totalBeetsAvailable,
                )} BEETS available on Reliquary (${beetsLeftOnReliquary} - ${totalPendingRewards}). With the current rate of ${currentRate}beets/s these will last until ${runOutDate.format()} but the new epoch will only be triggered at ${moment
                    .unix(lastTransferTimestamp.toNumber() + triggerDuration)
                    .format()}. You need to adjust the emission rate on Reliquary to ${formatUnits(
                    proposedEmissionRate,
                )} for them to last until the end of this epoch.`,
            ),
            ephemeral: true,
        });
    } else {
        const secondsSurplus =
            runOutDate.unix() - moment.unix(lastTransferTimestamp.toNumber() + triggerDuration).unix();
        await interaction.reply({
            content: codeBlock(
                `There are now ${formatUnits(
                    totalBeetsAvailable,
                )} BEETS available on Reliquary. With the current rate of ${currentRate}beets/s these will last until ${runOutDate.format()} while the new epoch will be triggered at ${moment
                    .unix(lastTransferTimestamp.toNumber() + triggerDuration)
                    .format()} leaving a surplus of ${moment
                    .utc(secondsSurplus * 1000)
                    .format('HH:mm:ss')}. Adjusted rate would be ${formatUnits(
                    proposedEmissionRate,
                )} to make sure they are used by the end of this epoch.`,
            ),
            ephemeral: true,
        });
    }
}

export const checkReliquaryRate: CommandHandler = {
    definition: new SlashCommandBuilder()
        .setName('check_reliquary_rate')
        .setDescription('Check the emission rate on reliquary and propose a better rate based on avaliable Beets.'),
    execute,
};
