import { networkConfig } from '../config/config';
import reliquaryBeetsStreamerAbi from '../../abi/ReliquaryBeetsStreamer.json';
import reliquaryAbi from '../../abi/Reliquary.json';
import erc20Abi from '../../abi/ERC20.json';
import BeetsConstantEmissionCurve from '../../abi/BeetsConstantEmissionCurve.json';
import moment from 'moment';
import { ChannelId, sendMessage } from '../interactions/send-message';
import { formatUnits } from 'ethers/lib/utils';
import axios from 'axios';
import { BigNumber, ContractTransaction } from 'ethers';
const { ethers } = require('hardhat');

const reliquarySubgraphUrl: string = 'https://api.thegraph.com/subgraphs/name/beethovenxfi/reliquary';
//TODO change back or run it every day?
// const triggerDuration = moment.duration(7, 'days').subtract(12, 'hours').asSeconds(); // 6days 12h
export const triggerDuration = moment.duration(1, 'days').subtract(12, 'hours').asSeconds(); // 12h

export async function streamBeetsToReliquary() {
    console.log('Schedule to stream beets to reliquary');
    await streamBeets();
    // every hour
    setInterval(streamBeets, 3600000);
}

export async function streamBeets() {
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
    const curveAddress = await reliquary.emissionCurve();
    const curve = await ethers.getContractAt(BeetsConstantEmissionCurve, curveAddress);
    //TODO change to real beets
    const beets = await ethers.getContractAt(erc20Abi, networkConfig.contractAddresses.TestBeethovenxToken);

    const beetsBefore = (await beets.balanceOf(networkConfig.contractAddresses.Reliquary)) as BigNumber;
    const oldRate = (await curve.getRate(0)) as BigNumber;
    let txn = (await reliquaryStreamer.startNewEpoch()) as ContractTransaction;
    await txn.wait();
    txn = await reliquary.updatePool(0);
    await txn.wait();
    const beetsLeftOnReliquary = (await beets.balanceOf(networkConfig.contractAddresses.Reliquary)) as BigNumber;
    const currentRate = (await curve.getRate(0)) as BigNumber;

    await sendMessage(
        ChannelId.MULTISIG_TX,
        `Sent ${formatUnits(
            beetsLeftOnReliquary.sub(beetsBefore),
        )} BEETS to Reliquary and set the rate from ${formatUnits(oldRate)} BEETS/s to ${formatUnits(
            currentRate,
        )} BEETS/s`,
    );

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
    const secondsOfBeetsLeft = totalBeetsAvailable.div(currentRate);
    const runOutDate = moment().add(secondsOfBeetsLeft.toNumber(), 'seconds');
    lastTransferTimestamp = (await reliquaryStreamer.lastTransferTimestamp()) as BigNumber;

    const epochEnd = moment.unix(lastTransferTimestamp.toNumber() + triggerDuration);
    const secondsInEpochLeft = epochEnd.unix() - moment().unix();

    const beetsNeeded = currentRate.mul(`${secondsInEpochLeft}`);
    const beetsDifferenceForEpoch = totalBeetsAvailable.sub(beetsNeeded);

    // spread the total beets available to 7 days
    const proposedEmissionRate = totalBeetsAvailable.div(
        moment.unix(lastTransferTimestamp.toNumber()).add(7, 'days').unix() - moment().unix(),
    );

    if (totalBeetsAvailable.lt(`0`)) {
        await sendMessage(
            ChannelId.MULTISIG_TX,
            `(@)here: The reliquary ran out of beets. It is lacking  ${formatUnits(totalBeetsAvailable)} BEETS.`,
        );
    }

    if (beetsDifferenceForEpoch.lt(`0`)) {
        await sendMessage(
            ChannelId.MULTISIG_TX,
            `(@)here Reliquary will run out of BEETS this epoch:
Beets available: ${formatUnits(totalBeetsAvailable)}
Current rate: ${formatUnits(currentRate)} BEETS/s
Depleted on: ${runOutDate.format()} 
New epoch start: ${epochEnd.format()}. 
Proposed emission rate change: ${formatUnits(proposedEmissionRate)} (${proposedEmissionRate}) 
Or send ${formatUnits(beetsNeeded.sub(totalBeetsAvailable))} (${beetsNeeded.sub(
                totalBeetsAvailable,
            )}) beets to reliquary.`,
        );
    } else {
        await sendMessage(
            ChannelId.MULTISIG_TX,
            `Beets available: ${formatUnits(totalBeetsAvailable)}
Current rate: ${formatUnits(currentRate)} BEETS/s 
Depleted on: ${runOutDate.format()} 
Surplus of ${formatUnits(beetsDifferenceForEpoch)} BEETS. 
New epoch start: ${epochEnd.format()} 
Proposed emission rate change: ${formatUnits(proposedEmissionRate)} (${proposedEmissionRate})`,
        );
    }
}
