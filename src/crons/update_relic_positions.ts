import axios from 'axios';
import { Multicaller } from '../utils/Multicaller';
import { networkConfig } from '../config/config';
import reliquaryAbi from '../../abi/Reliquary.json';

const reliquarySubgraphUrl: string = 'https://api.thegraph.com/subgraphs/name/beethovenxfi/reliquary/graphql';

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

    const poolLevels = await axios.post<{ pools: [{ pid: Number; levels: [{ level: number }] }] }>(
        reliquarySubgraphUrl,
        `query{
            pools{
                pid
                levels{
                    level
                }
            }
        }`,
    );

    const poolMaxLevels = poolLevels.data.pools.map((pool) => {
        return { pid: pool.pid, maxLevel: Math.max(...pool.levels.map((level) => level.level)) };
    });

    const relicIdsToUpdate: number[] = [];

    for (const pool of poolMaxLevels) {
        const relicsNotInMaxLevel = await axios.post<{ relics: [{ relicId: number }] }>(
            reliquarySubgraphUrl,
            `query {   
                relics(where: {pid: ${pool.pid}, level_lt: ${pool.maxLevel}}){
                    relicId
                }
            }`,
        );
        relicsNotInMaxLevel.data.relics.forEach((relic) => relicIdsToUpdate.push(relic.relicId));
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
