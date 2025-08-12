import { ChannelId, sendMessage } from '../interactions/send-message';
import axios from 'axios';
import { createPublicClient, createWalletClient, http, formatUnits } from 'viem';
import { readContract, writeContract, waitForTransactionReceipt } from 'viem/actions';
import { privateKeyToAccount } from 'viem/accounts';

const BACKEND_URL = 'https://backend-v3.beets-ftm-node.com/graphql';

const sonicChain = {
    id: 146,
    name: 'Sonic',
    network: 'sonic',
    nativeCurrency: {
        decimals: 18,
        name: 'Sonic',
        symbol: 'S',
    },
    rpcUrls: {
        default: { http: ['https://rpc.soniclabs.com'] },
        public: { http: ['https://rpc.soniclabs.com'] },
    },
    blockExplorers: {
        default: { name: 'Sonic Explorer', url: 'https://sonicscan.org' },
    },
} as const;

const publicClient = createPublicClient({
    chain: sonicChain,
    transport: http('https://rpc.soniclabs.com'),
});

type PoolToken = {
    address: string;
    balanceUSD: string;
    priceRateProviderData?: {
        name: string;
        address?: string;
    };
};

type TokenPrice = {
    address: string;
    price: number;
};

const RATE_PROVIDER_ABI = [
    {
        inputs: [],
        name: 'feed',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'getRate',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'updateToEdge',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const;

type Pool = {
    id: string;
    poolTokens: PoolToken[];
};

type PoolQueryResponse = {
    data: {
        poolGetPools: Pool[];
    };
};

async function fetchTokenPrices(): Promise<TokenPrice[]> {
    try {
        const response = await axios.post(BACKEND_URL, {
            query: `{
                tokenGetCurrentPrices(chains: [SONIC]) {
                    address
                    price
                }
            }`,
        });
        return response.data.data.tokenGetCurrentPrices;
    } catch (error) {
        console.error('Error fetching token prices:', error);
        return [];
    }
}

async function validateRateProviderPrice(
    rateProviderAddress: string,
    tokenAddress: string,
    tokenPrices: TokenPrice[],
): Promise<boolean> {
    try {
        const feedAddress = await publicClient.readContract({
            address: rateProviderAddress as `0x${string}`,
            abi: RATE_PROVIDER_ABI,
            functionName: 'feed',
        });

        const rate = await publicClient.readContract({
            address: feedAddress,
            abi: RATE_PROVIDER_ABI,
            functionName: 'getRate',
        });

        const rateValue = parseFloat(formatUnits(rate, 18));

        const tokenPrice = tokenPrices.find((p) => p.address.toLowerCase() === tokenAddress.toLowerCase());
        if (!tokenPrice) {
            console.log(`Token price not found for ${tokenAddress}`);
            return false;
        }

        const priceDifference = Math.abs(rateValue - tokenPrice.price) / tokenPrice.price;
        const isValid = priceDifference <= 0.02;

        console.log(
            `Rate validation for ${tokenAddress}: rate=${rateValue}, price=${tokenPrice.price}, diff=${(
                priceDifference * 100
            ).toFixed(2)}%, valid=${isValid}`,
        );

        return isValid;
    } catch (error) {
        console.error(`Error validating rate provider ${rateProviderAddress}:`, error);
        return false;
    }
}

async function updateRateProviderToEdge(rateProviderAddress: string): Promise<boolean> {
    try {
        if (!process.env.RELIC_UPDATER) {
            console.log('No RELIC_UPDATER private key configured');
            return false;
        }

        const account = privateKeyToAccount(process.env.RELIC_UPDATER as `0x${string}`);

        const walletClient = createWalletClient({
            account,
            chain: sonicChain,
            transport: http('https://rpc.soniclabs.com'),
        });

        const txHash = await walletClient.writeContract({
            address: rateProviderAddress as `0x${string}`,
            abi: RATE_PROVIDER_ABI,
            functionName: 'updateToEdge',
        });

        await publicClient.waitForTransactionReceipt({
            hash: txHash,
        });

        console.log(`Successfully updated rate provider ${rateProviderAddress} to edge. Tx: ${txHash}`);
        return true;
    } catch (error) {
        console.error(`Error updating rate provider ${rateProviderAddress}:`, error);
        return false;
    }
}

export async function scheduleDynamicEclpRangeUpdater() {
    console.log('Schedule dynamic eclp range updater');
    await updateDynamicEclpRanges();
    // every 30 mins
    setInterval(updateDynamicEclpRanges, 30 * 60000);
}

export async function updateDynamicEclpRanges() {
    console.log('Checking and updating dynamic ECLP ranges');

    try {
        const [tokenPrices, poolsResponse] = await Promise.all([
            fetchTokenPrices(),
            axios.post<PoolQueryResponse>(BACKEND_URL, {
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
                                address
                            }
                        }
                    }
                }`,
            }),
        ]);

        const pools = poolsResponse.data.data.poolGetPools;
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

        let updatedRanges = 0;
        const updateResults: string[] = [];

        for (const pool of outOfRangePools) {
            for (const token of pool.poolTokens) {
                if (
                    token.priceRateProviderData?.name?.toLowerCase().includes('dynamic') &&
                    token.priceRateProviderData.address
                ) {
                    const isValidPrice = await validateRateProviderPrice(
                        token.priceRateProviderData.address,
                        token.address,
                        tokenPrices,
                    );

                    if (isValidPrice) {
                        const updateSuccess = await updateRateProviderToEdge(token.priceRateProviderData.address);

                        if (updateSuccess) {
                            updatedRanges++;
                            updateResults.push(`✅ Updated range for pool ${pool.id} (token ${token.address})`);
                        } else {
                            updateResults.push(
                                `❌ Failed to update range for pool ${pool.id} (token ${token.address})`,
                            );
                        }
                    } else {
                        updateResults.push(
                            `⚠️ Skipped update for pool ${pool.id} (token ${token.address}) - price validation failed`,
                        );
                    }
                }
            }
        }

        if (updateResults.length > 0) {
            const message =
                `🔄 **Dynamic ECLP Range Update Results** 🔄\n\n` +
                `Found ${outOfRangePools.length} out-of-range pool(s), updated ${updatedRanges} range(s):\n\n` +
                updateResults.join('\n');

            await sendMessage(ChannelId.SERVER_STATUS, message);
        }

        console.log(
            `Processed ${pools.length} ECLP pools, found ${dynamicEclpPools.length} dynamic pools, ${outOfRangePools.length} out of range, updated ${updatedRanges} ranges`,
        );
    } catch (error) {
        console.error('Error updating dynamic ECLP ranges:', error);
        await sendMessage(ChannelId.SERVER_STATUS, `❌ Error updating dynamic ECLP ranges: ${error}`);
    }
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
                            address
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
