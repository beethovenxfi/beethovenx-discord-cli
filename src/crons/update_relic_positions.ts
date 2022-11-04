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
    // every hour
    setInterval(updateLevelsOfRelics, 3600000);
}

export async function updateLevelsOfRelics() {
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
                        pools{
                            pid
                            levels{
                                level
                                requiredMaturity
                            }
                        }
                    }`,
    });

    const relicIdsToUpdate: number[] = [];

    const now = moment().unix();
    for (const pool of poolLevels.data.data.pools) {
        const maxLevel = Math.max(...pool.levels.map((level) => level.level));
        const relicsNotInMaxLevel = await axios.post<{
            data: { relics: [{ relicId: number; level: number; entryTimestamp: number }] };
        }>(reliquarySubgraphUrl, {
            query: `{   
                        relics(where: {pid: ${pool.pid}, level_lt: ${maxLevel}}){
                            relicId
                            level
                            entryTimestamp
                        }
                    }`,
        });

        relicsNotInMaxLevel.data.data.relics.forEach((relic) => {
            const requiredMaturityForNextLevel = pool.levels[relic.level + 1].requiredMaturity;
            if (relic.entryTimestamp + requiredMaturityForNextLevel < now) {
                // relic has entered next level
                relicIdsToUpdate.push(relic.relicId);
            }
        });
    }

    console.log(`Updating ${relicIdsToUpdate.length} relics.`);

    for (const relicIdToUpdate of relicIdsToUpdate) {
        const reliquary = await ethers.getContractAt(reliquaryAbi, networkConfig.contractAddresses.Reliquary);
        try {
            await reliquary.updatePosition(relicIdToUpdate);
        } catch (e) {
            await sendMessage(
                ChannelId.MULTISIG_TX,
                `Failed to update relic with ID ${inlineCode(relicIdToUpdate.toString())}!`,
            );
        }
    }
}
