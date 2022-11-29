import { networkConfig } from '../config/config';
import reliquaryBeetsStreamerAbi from '../../abi/ReliquaryBeetsStreamer.json';
import reliquaryAbi from '../../abi/Reliquary.json';
import erc20Abi from '../../abi/ERC20.json';
import moment from 'moment';
import { ChannelId, sendMessage } from '../interactions/send-message';
import { formatUnits } from 'ethers/lib/utils';
import axios from 'axios';
import { BigNumber } from 'ethers';
const { ethers } = require('hardhat');

const reliquarySubgraphUrl: string = 'https://api.thegraph.com/subgraphs/name/beethovenxfi/reliquary';
// TODO change back
// const triggerDuration = moment.duration(7, 'days').subtract(12, 'hours').asSeconds(); // 6days 12h
const triggerDuration = moment.duration(1, 'days').subtract(12, 'hours').asSeconds(); // 12h

export async function streamBeetsToReliquary() {
    console.log('Schedule to stream beets to reliquary');
    await streamBeets();
    // every hour
    setInterval(streamBeets, 3600000);
}

async function streamBeets() {
    console.log('checking if need to start epoch');

    const reliquaryStreamer = await ethers.getContractAt(
        reliquaryBeetsStreamerAbi,
        networkConfig.contractAddresses.ReliquaryBeetsStreamer,
    );
    let lastTransferTimestamp = (await reliquaryStreamer.lastTransferTimestamp()) as BigNumber;

    if (lastTransferTimestamp.toNumber() + triggerDuration > moment().unix()) {
        // trigger duration not yet passed
        return;
    }
    const reliquary = await ethers.getContractAt(reliquaryAbi, networkConfig.contractAddresses.Reliquary);
    const beets = await ethers.getContractAt(erc20Abi, networkConfig.contractAddresses.BeethovenxToken);

    const beetsBefore = (await beets.balanceOf(networkConfig.contractAddresses.Reliquary)) as BigNumber;
    const oldRate = (await reliquary.getRate(0)) as BigNumber;
    await reliquaryStreamer.startNewEpoch();
    const beetsAfter = (await beets.balanceOf(networkConfig.contractAddresses.Reliquary)) as BigNumber;
    const newRate = (await reliquary.getRate(0)) as BigNumber;

    await sendMessage(
        ChannelId.MULTISIG_TX,
        `Sent ${formatUnits(beetsAfter.sub(beetsBefore))} BEETS to Reliquary and set the rate from ${formatUnits(
            oldRate,
        )}beets/s to ${formatUnits(newRate)}beets/s`,
    );

    // calculate remaining beets
    const allRelics = await axios.post<{
        data: { relics: [{ relicId: number }] };
    }>(reliquarySubgraphUrl, {
        query: `{   
                    relics(){
                        relicId
                    }
                }`,
    });
    let totalPendingRewards = BigNumber.from(0);
    for (const relic of allRelics.data.data.relics) {
        totalPendingRewards.add(reliquary.pendingReward(relic.relicId));
    }

    // check when we run out
    const totalBeetsAvailable = beetsAfter.sub(totalPendingRewards);
    const secondsOfBeets = totalBeetsAvailable.div(newRate);
    const runOutDate = moment().add(formatUnits(secondsOfBeets), 'seconds');
    lastTransferTimestamp = (await reliquaryStreamer.lastTransferTimestamp()) as BigNumber;

    if (runOutDate.unix() < lastTransferTimestamp.toNumber() + triggerDuration) {
        // spread the total beets available to 7 days
        const proposedEmissionRate = totalBeetsAvailable.div(
            moment.unix(lastTransferTimestamp.toNumber()).add(7, 'days').unix() - moment().unix(),
        );
        await sendMessage(
            ChannelId.MULTISIG_TX,
            `(@)here There are now ${formatUnits(
                totalBeetsAvailable,
            )} BEETS available on Reliquary. With the new rate, these will last until ${runOutDate.format()} but the new epoch will only be triggered at ${moment
                .unix(lastTransferTimestamp.toNumber() + triggerDuration)
                .format()}.`,
        );
        await sendMessage(
            ChannelId.MULTISIG_TX,
            `You need to adjust the emission rate on Reliquary to ${formatUnits(proposedEmissionRate)}.`,
        );
    } else {
        const secondsSurplus =
            runOutDate.unix() - moment.unix(lastTransferTimestamp.toNumber() + triggerDuration).unix();
        await sendMessage(
            ChannelId.MULTISIG_TX,
            `There are now ${formatUnits(
                totalBeetsAvailable,
            )} BEETS available on Reliquary. With the new rate, these will last until ${runOutDate.format()} while the new epoch will be triggered at ${moment
                .unix(lastTransferTimestamp.toNumber() + triggerDuration)
                .format()} leaving a surplus of ${moment.utc(secondsSurplus * 1000).format('HH:mm:ss')}.`,
        );
    }
}
