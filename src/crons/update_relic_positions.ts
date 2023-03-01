import axios from 'axios';
import { networkConfig } from '../config/config';
import reliquaryAbi from '../../abi/Reliquary.json';
import moment from 'moment';
import { BigNumber } from 'ethers';
import { parseFixed } from '@ethersproject/bignumber';
import { ChannelId, sendMessage } from '../interactions/send-message';
import { inlineCode } from '@discordjs/builders';
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
        const nonEmptyNonMaxLevelRelics = await axios.post<{
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
                        relics(where: {pid: ${pool.pid}, level_lt: ${maxLevel}, balance_gt: "0"}){
                            relicId
                            level
                            entryTimestamp
                            user { id }
                        }
                    }`,
        });

        nonEmptyNonMaxLevelRelics.data.data.relics.forEach((relic) => {
            const requiredMaturityForNextLevel = pool.levels[relic.level + 1].requiredMaturity;
            if (
                relic.user.id !== '0x0000000000000000000000000000000000000000' &&
                relic.entryTimestamp + requiredMaturityForNextLevel < threeDaysAgo
            ) {
                // relic has entered next level three days ago
                relicIdsToUpdate.push(relic.relicId);
            }
        });
    }

    if (relicIdsToUpdate.length > 0) {
        console.log(`Updating ${relicIdsToUpdate.length} relics.`);
        await sendMessage(ChannelId.MULTISIG_TX, `Updating ${relicIdsToUpdate.length} relics`);
        const reliquary = await ethers.getContractAt(reliquaryAbi, networkConfig.contractAddresses.Reliquary);
        for (const relicIdToUpdate of relicIdsToUpdate) {
            try {
                const txn = await reliquary.updatePosition(relicIdToUpdate);
                await txn.wait();
                console.log(`Updated relic ${relicIdToUpdate}.`);
            } catch (e) {
                await sendMessage(
                    ChannelId.MULTISIG_TX,
                    `Failed to update relic with ID ${inlineCode(relicIdToUpdate.toString())}!`,
                );
                console.log(e);
            }
        }
    }
}
