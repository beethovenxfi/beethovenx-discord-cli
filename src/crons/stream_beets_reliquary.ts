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
const { ethers } = require('hardhat');

const reliquarySubgraphUrl: string = 'https://api.studio.thegraph.com/query/73674/reliquary/version/latest';
const fBeetsPoolId: number = 1;
//TODO change back or run it every day?
export const triggerDuration = moment.duration(2, 'days').subtract(30, 'minutes').asSeconds(); // 1day 23h 30m
// every hour
export const intervalMs = 3600000;

export async function streamBeetsToReliquary() {
    console.log('Schedule to stream beets to reliquary');
    await streamBeets();
    setInterval(streamBeets, intervalMs);
}

export async function streamBeets() {
    console.log('checking if need to start epoch');

    const reliquaryStreamer = await ethers.getContractAt(
        reliquaryBeetsStreamerAbi,
        networkConfig.contractAddresses.ReliquaryBeetsStreamer,
    );

    const updaterBalance: BigNumber = await ethers.provider.getBalance(networkConfig.walletAddresses.relicUpdater);
    if (updaterBalance.lt(parseUnits(`1`, 18))) {
        await sendMessage(
            ChannelId.SERVER_STATUS,
            `The wallet for the Reliquary service is running low. Please send FTM to ${inlineCode(
                networkConfig.walletAddresses.relicUpdater,
            )}!`,
        );
        return;
    }

    let lastTransferTimestamp = (await reliquaryStreamer.lastTransferTimestamp()) as BigNumber;
    const reliquary = await ethers.getContractAt(reliquaryAbi, networkConfig.contractAddresses.Reliquary);
    const curveAddress = await reliquary.emissionCurve();
    const curve = await ethers.getContractAt(BeetsConstantEmissionCurve, curveAddress);

    const beets = await ethers.getContractAt(erc20Abi, networkConfig.contractAddresses.BeethovenxToken);

    let beetsLeftOnReliquary = (await beets.balanceOf(networkConfig.contractAddresses.Reliquary)) as BigNumber;
    const oldRate = (await curve.getRate(0)) as BigNumber;

    if (oldRate.eq(0)) {
        //reliquary does not emit beets, return
        return;
    }

    if (lastTransferTimestamp.toNumber() + triggerDuration > moment().unix()) {
        // trigger duration not yet passed check for balance anyway
        checkBeetsBalance(reliquary, beetsLeftOnReliquary, oldRate, reliquaryStreamer, true);
        return;
    }

    const beetsBefore = (await beets.balanceOf(networkConfig.contractAddresses.Reliquary)) as BigNumber;
    // we update the pool before and after the new epoch to make sure any changes before and after are reflected
    let txn = await reliquary.updatePool(fBeetsPoolId);
    await txn.wait();
    txn = (await reliquaryStreamer.startNewEpoch()) as ContractTransaction;
    await txn.wait();
    txn = await reliquary.updatePool(fBeetsPoolId);
    await txn.wait();
    beetsLeftOnReliquary = (await beets.balanceOf(networkConfig.contractAddresses.Reliquary)) as BigNumber;
    const currentRate = (await curve.getRate(0)) as BigNumber;

    await sendMessage(
        ChannelId.SERVER_STATUS,
        `Sent ${formatUnits(
            beetsLeftOnReliquary.sub(beetsBefore),
        )} BEETS to Reliquary and set the rate from ${formatUnits(oldRate)} BEETS/s to ${formatUnits(
            currentRate,
        )} BEETS/s`,
    );

    // check for beets balance
    await checkBeetsBalance(reliquary, beetsLeftOnReliquary, currentRate, reliquaryStreamer, false);
}

async function checkBeetsBalance(
    reliquary: any,
    beetsLeftOnReliquary: BigNumber,
    currentRate: BigNumber,
    reliquaryStreamer: any,
    alertOnly: boolean,
) {
    const allRelics = await axios.post<{
        data: { relics: [{ relicId: number }] };
    }>(reliquarySubgraphUrl, {
        query: `{   
            relics(where: {pid: ${fBeetsPoolId}}) {
                relicId
            }
            }`,
    });

    if (!allRelics.data.data) {
        return;
    }

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

    // spread the total beets available to 7 days
    const proposedEmissionRate = totalBeetsAvailable.div(triggerDuration);

    if (totalBeetsAvailable.lt(`0`)) {
        await sendMessage(
            ChannelId.SERVER_STATUS,
            `(@)here: The reliquary ran out of beets. It is lacking  ${formatUnits(totalBeetsAvailable)} BEETS.`,
        );
    }

    if (beetsDifferenceForEpoch.lt(`0`)) {
        await sendMessage(
            ChannelId.SERVER_STATUS,
            `(@)here Reliquary will run out of BEETS this epoch:
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
        );
    } else {
        if (!alertOnly) {
            await sendMessage(
                ChannelId.SERVER_STATUS,
                `Beets available: ${formatUnits(totalBeetsAvailable)}
Current rate: ${formatUnits(currentRate)} BEETS/s 
Depleted on: ${runOutDate.format()} 
Surplus of ${formatUnits(beetsDifferenceForEpoch)} BEETS. 
New epoch start: ${epochEnd.format()} 
Proposed emission rate change to use all available BEETS: ${formatUnits(
                    proposedEmissionRate,
                )} (${proposedEmissionRate})`,
            );
        }
    }
    return lastTransferTimestamp;
}
