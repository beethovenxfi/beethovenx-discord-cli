import axios from 'axios';
import { networkConfig } from '../config/config';
import reliquaryAbi from '../../abi/Reliquary.json';
import moment, { now } from 'moment';
import { BigNumber } from 'ethers';
import { parseFixed } from '@ethersproject/bignumber';
import { ChannelId, sendMessage } from '../interactions/send-message';
import { inlineCode } from '@discordjs/builders';
import instantUpdateRelics from './updateRelics.json';
import { proposedGasPriceFantom } from '../utils';
import { fail } from 'assert';
const { ethers } = require('hardhat');

const reliquarySubgraphUrl: string = 'https://api.thegraph.com/subgraphs/name/beethovenxfi/reliquary';

export async function updateRelics() {
    console.log('Schedule updating relics');
    await updateLevelsOfRelics();
    // every 2 hours
    setInterval(updateLevelsOfRelics, 2 * 3600000);
}

async function updateLevelsOfRelics() {
    console.log('updating relic positions');
    const updateRelicIdList: number[] = instantUpdateRelics;

    const updaterBalance: BigNumber = await ethers.provider.getBalance(networkConfig.walletAddresses.relicUpdater);
    if (updaterBalance.lt(parseFixed(`1`, 18))) {
        await sendMessage(
            ChannelId.MULTISIG_TX,
            `@here The wallet for the relic updatePosition service is running low. Please send FTM to ${inlineCode(
                networkConfig.walletAddresses.relicUpdater,
            )}!`,
        );
        return;
    }

    const poolLevels = await axios.post<{
        data: { pools: [{ pid: Number; levels: [{ level: number; requiredMaturity: number }] }] };
    }>(reliquarySubgraphUrl, {
        query: `{
                        pools(where: {pid_in: [2]}){
                            pid
                            levels{
                                level
                                requiredMaturity
                            }
                        }
                    }`,
    });

    const relicIdsToUpdate: number[] = [];

    const threeDaysAgo = moment().subtract(3, 'days').unix();
    for (const pool of poolLevels.data.data.pools) {
        const maxLevel = Math.max(...pool.levels.map((level) => level.level));

        const limit = 1000;
        let hasMore = true;
        let nonEmptyNonMaxLevelRelics: {
            relicId: number;
            level: number;
            entryTimestamp: number;
            user: { id: string };
        }[] = [];
        let id = 0;

        while (hasMore) {
            const response = await axios.post<{
                data: {
                    relics: [
                        {
                            relicId: number;
                            level: number;
                            entryTimestamp: number;
                            user: { id: string };
                        },
                    ];
                };
            }>(reliquarySubgraphUrl, {
                query: `{   
                            relics(where: {pid: ${pool.pid}, level_lt: ${maxLevel}, balance_gt: "0", relicId_gt: ${id}}, orderBy: relicId, orderDirection: asc, first: 1000){
                                relicId
                                level
                                entryTimestamp
                                user { id }
                            }
                        }`,
            });

            nonEmptyNonMaxLevelRelics = [...nonEmptyNonMaxLevelRelics, ...response.data.data.relics];

            if (response.data.data.relics.length < limit) {
                hasMore = false;
            } else {
                id = response.data.data.relics[response.data.data.relics.length - 1].relicId;
            }
        }

        nonEmptyNonMaxLevelRelics.forEach((relic) => {
            const requiredMaturityForNextLevel = pool.levels[relic.level + 1].requiredMaturity;
            if (
                (relic.user.id !== '0x0000000000000000000000000000000000000000' &&
                    relic.entryTimestamp + requiredMaturityForNextLevel < threeDaysAgo) ||
                (updateRelicIdList.includes(relic.relicId) &&
                    relic.entryTimestamp + requiredMaturityForNextLevel < moment().unix())
            ) {
                // relic has entered next level three days ago
                relicIdsToUpdate.push(relic.relicId);
            }
        });
    }

    if (relicIdsToUpdate.length > 0) {
        console.log(`Updating ${relicIdsToUpdate.length} relics.`);
        let updatedRelics = 0;
        let gasPriceTooHigh = 0;
        let failedRelics = 0;
        const reliquary = await ethers.getContractAt(reliquaryAbi, networkConfig.contractAddresses.Reliquary);
        for (const relicIdToUpdate of relicIdsToUpdate) {
            try {
                const txn = await reliquary.updatePosition(relicIdToUpdate, { gasPrice: 40000000000 });
                await txn.wait();
                console.log(`Updated relic: ${relicIdToUpdate}.`);
                updatedRelics++;
            } catch (e) {
                failedRelics++;
                console.log(`Failed to update relic: ${relicIdToUpdate}.`);
                console.log(e);
            }
        }
        await sendMessage(
            ChannelId.MULTISIG_TX,
            `Updated relics: ${inlineCode(updatedRelics.toString())} 
Failed relic updates: ${inlineCode(failedRelics.toString())}`,
        );
    }
}
