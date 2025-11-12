import { formatUnits } from 'ethers/lib/utils';
import { ChannelId, sendMessage } from '../interactions/send-message';
import { ethers } from 'ethers';

const pools: { [poolName: string]: { referencePool: string; beetsPool: string } } = {
    'scusd/usdc-reclamm': {
        referencePool: '0x2c13383855377faf5a562f1aef47e4be7a0f12ac',
        beetsPool: '0x02e84edccf97e54bfb505b478da1d931dda13d78',
    },
    'scusd/usdc': {
        referencePool: '0x2c13383855377faf5a562f1aef47e4be7a0f12ac',
        beetsPool: '0x8d2a7e007053772340e1a8cd827512a71de94038',
    },
    'sts/ws-reclamm': {
        referencePool: '0xde861c8fc9ab78fe00490c5a38813d26e2d09c95',
        beetsPool: '0x5c9cf0f763bbde1126c5c2b06132d519fc0d2052',
    },
    'sts/ws': {
        referencePool: '0xde861c8fc9ab78fe00490c5a38813d26e2d09c95',
        beetsPool: '0x75b000584a7d86fb3ef5e15ba26f4c52b41be0e9',
    },
    'weth/usdc-reclamm': {
        referencePool: '0x6fb30f3fcb864d49cdff15061ed5c6adfee40b40',
        beetsPool: '0x4aff385131de823ec412db504d88eef646707de9',
    },
    'ws/usdc-reclamm': {
        referencePool: '0x324963c267c354c7660ce8ca3f5f167e05649970',
        beetsPool: '0xa4c937817f99829ac4003a3475f17a2f0d6eaf7c',
    },
    // 'scbtc/weth-reclamm': {
    //     referencePool: '0x6b19c48449ce9de4254a883749257be5da660bfb',
    //     beetsPool: '0xc16036a6b9395303601bd41aa8f46f560adfdfe7',
    // },
};

const RPC_URL = 'https://rpc.soniclabs.com';
const SWAP_FEE_HELPER_ADDRESS = '0x9dCC172B1E4Ec399d2b929ef49f0A09483687c67';
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

const fee_abi = [
    {
        inputs: [],
        name: 'fee',
        outputs: [{ internalType: 'uint24', name: '', type: 'uint24' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'getStaticSwapFeePercentage',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'pool', type: 'address' },
            { internalType: 'uint256', name: 'swapFeePercentage', type: 'uint256' },
        ],
        name: 'setStaticSwapFeePercentage',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const;
export async function scheduleDynamicFeeUpdater() {
    console.log('Schedule dynamic fee updater');
    await updateDynamicFees();
    // every 5min
    setInterval(updateDynamicFees, 5 * 60 * 1000);
}

export async function updateDynamicFees() {
    console.log('Checking and updating dynamic fee');
    try {
        // for each pool in the mapping, fetch the fees via onchain call
        for (const [poolName, { referencePool, beetsPool }] of Object.entries(pools)) {
            try {
                const beetsPoolContract = new ethers.Contract(beetsPool, fee_abi, provider);
                const fee = await beetsPoolContract.getStaticSwapFeePercentage();
                const beetsFeePercentage = Number(formatUnits(fee, 18));
                const referencePoolContract = new ethers.Contract(referencePool, fee_abi, provider);
                const referenceFee = await referencePoolContract.fee();
                const referenceFeePercentage = Number(formatUnits(referenceFee, 6));
                // new fee is 15% less than the reference fee, round to 8 decimal places
                const newBeetsFeePercentage = Math.round(referenceFeePercentage * 0.85 * 1e8) / 1e8;
                // define fee difference boundaries between 10 and 20 percent
                const maxBeetsFeePercentage = Math.round(referenceFeePercentage * 0.9 * 1e8) / 1e8;
                const minBeetsFeePercentage = Math.round(referenceFeePercentage * 0.8 * 1e8) / 1e8;
                // if the new percentage is outside the boundaries, update it to new percentage
                if (beetsFeePercentage > maxBeetsFeePercentage || beetsFeePercentage < minBeetsFeePercentage) {
                    console.log(
                        `Pool ${poolName} (${beetsPool}) fee calculation out of bounds, setting from ${
                            beetsFeePercentage * 100
                        }% to ${newBeetsFeePercentage * 100}% (ref: ${referenceFeePercentage * 100}%)`,
                    );
                    await updateSwapFee(beetsPool, newBeetsFeePercentage);
                    await sendMessage(
                        ChannelId.SERVER_STATUS,
                        `✅ Updated swap fee for pool ${poolName} (${beetsPool}): ${(beetsFeePercentage * 100).toFixed(
                            6,
                        )}% -> ${(newBeetsFeePercentage * 100).toFixed(6)}% (ref: ${(
                            referenceFeePercentage * 100
                        ).toFixed(6)}%)`,
                    );
                } else {
                    console.log(
                        `Pool ${poolName} (${beetsPool}) fee within bounds, no update needed. Current: ${
                            beetsFeePercentage * 100
                        }%, Ref: ${referenceFeePercentage * 100}%, Bounds: [${minBeetsFeePercentage * 100}%, ${
                            maxBeetsFeePercentage * 100
                        }%]`,
                    );
                }
            } catch (error) {
                console.error(`Error fetching fee for pool ${beetsPool}:`, error);
            }
        }
    } catch (error) {
        console.error('Error updating dynamic fees:', error);
        await sendMessage(ChannelId.SERVER_STATUS, `❌ Error updating dynamic fees: ${error}`);
    }
}

async function updateSwapFee(poolAddress: string, newFeePercentage: number) {
    if (!process.env.FEE_UPDATER) {
        console.log('No FEE_UPDATER private key configured');
        return false;
    }

    const wallet = new ethers.Wallet(process.env.FEE_UPDATER, provider);
    const swapFeeHelper = new ethers.Contract(SWAP_FEE_HELPER_ADDRESS, fee_abi, wallet);

    const newFeeScaled = ethers.utils.parseUnits(newFeePercentage.toString(), 18);
    const tx = await swapFeeHelper.setStaticSwapFeePercentage(poolAddress, newFeeScaled);
    const receipt = await tx.wait();

    console.log(
        `Successfully updated pool ${poolAddress} fee to ${newFeePercentage}%. Tx hash: ${receipt.transactionHash}`,
    );
}
