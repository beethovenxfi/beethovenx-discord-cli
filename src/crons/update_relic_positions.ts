import axios from 'axios';
import { Multicaller } from '../utils/Multicaller';
import { networkConfig } from '../config/config';
import reliquaryAbi from '../../abi/Reliquary.json';
import moment from 'moment';

const reliquarySubgraphUrl: string = 'https://api.thegraph.com/subgraphs/name/beethovenxfi/reliquary';

export async function updateRelics() {
    console.log('Schedule updating relics');
    await updateLevelsOfRelics();
    // every hour
    setInterval(updateLevelsOfRelics, 3600000);
}

export async function updateLevelsOfRelics() {
    console.log('updating relic positions');

    // check ftm wallet balance as well
    // ftmscan api :https://api.ftmscan.com/api?module=account&action=balance&address=0x5A534988535cf27a70e74dFfe299D06486f185B7&apikey=YourApiKeyToken

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
    const poolMaxLevels = poolLevels.data.data.pools.map((pool) => {
        return { pid: pool.pid, maxLevel: Math.max(...pool.levels.map((level) => level.level)) };
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

    const multicall = new Multicaller(networkConfig.contractAddresses.multicall, reliquaryAbi);

    for (const relicToUpdate of relicIdsToUpdate) {
        multicall.call(`${relicToUpdate}`, networkConfig.contractAddresses.Reliquary, 'updatePosition', [
            relicToUpdate,
        ]);

        // execute every 100 calls
        if (multicall.numCalls >= 100) {
            await multicall.execute();
        }
    }

    // execute any left over calls
    if (multicall.numCalls >= 0) {
        await multicall.execute();
    }
}
