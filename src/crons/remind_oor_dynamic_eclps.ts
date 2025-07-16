import { ChannelId, sendMessage } from '../interactions/send-message';
import axios from 'axios';

const BACKEND_URL = 'https://backend-v3.beets-ftm-node.com/graphql';

type PoolToken = {
    address: string;
    balanceUSD: string;
    priceRateProviderData?: {
        name: string;
    };
};

type Pool = {
    id: string;
    poolTokens: PoolToken[];
};

type PoolQueryResponse = {
    data: {
        poolGetPools: Pool[];
    };
};

export async function scheduleDynamicEclpOutOfRangeCheck() {
    console.log('Schedule dynamic eclp out of range check');
    await findOorDynamicEclps();
    // every 30 mins
    setInterval(findOorDynamicEclps, 30 * 60000);
}

export async function findOorDynamicEclps() {
    console.log('checking if dynamic eclps are out of range');

    try {
        const response = await axios.post<PoolQueryResponse>(BACKEND_URL, {
            query: `{
                poolGetPools(
                    where: {chainIn: [SONIC], protocolVersionIn: [2], poolTypeIn:[GYROE]}
                ) {
                    id
                    poolTokens{
                        address
                        balanceUSD
                        priceRateProviderData{
                            name
                        }
                    }
                }
            }`,
        });

        const pools = response.data.data.poolGetPools;
        const dynamicEclpPools = pools.filter((pool) =>
            pool.poolTokens.some((token) => token.priceRateProviderData?.name?.toLowerCase().includes('dynamic')),
        );

        const outOfRangePools = dynamicEclpPools.filter((pool) => {
            if (pool.poolTokens.length !== 2) return false;

            const [token1, token2] = pool.poolTokens;
            const balance1 = parseFloat(token1.balanceUSD);
            const balance2 = parseFloat(token2.balanceUSD);

            return (balance1 < 0.01 && balance2 > 10) || (balance1 > 10 && balance2 < 0.01);
        });

        if (outOfRangePools.length > 0) {
            const message =
                `⚠️ **Dynamic ECLP Pools Out of Range** ⚠️\n\n` +
                `Found ${outOfRangePools.length} dynamic ECLP pool(s) that are out of range:\n\n` +
                outOfRangePools
                    .map((pool) => {
                        const [token1, token2] = pool.poolTokens;
                        return (
                            `**Pool:** https://beets.fi/pools/sonic/v2/${pool.id}\n` +
                            `• Token 1: $${parseFloat(token1.balanceUSD).toFixed(2)}\n` +
                            `• Token 2: $${parseFloat(token2.balanceUSD).toFixed(2)}\n`
                        );
                    })
                    .join('\n');

            await sendMessage(ChannelId.SERVER_STATUS, message);
        }

        console.log(
            `Checked ${pools.length} ECLP pools, found ${dynamicEclpPools.length} dynamic pools, ${outOfRangePools.length} out of range`,
        );
    } catch (error) {
        console.error('Error checking dynamic ECLP pools:', error);
        await sendMessage(ChannelId.SERVER_STATUS, `❌ Error checking dynamic ECLP pools: ${error}`);
    }
}
