import { BigNumber } from 'ethers';
import { parseFixed } from '@ethersproject/bignumber';
import sonicStakingAbi from '../../abi/SonicStaking.json';
import { ChannelId, sendMessage } from '../interactions/send-message';
import { networkConfig } from '../config/config';
import axios from 'axios';
import { inlineCode } from '@discordjs/builders';
const { ethers } = require('hardhat');

const sonicStakingContract = '0xe5da20f15420ad15de0fa650600afc998bbe3955';

export async function claimStsRewards() {
    console.log('Schedule claim sftmx rewards');
    await claimAllStSRewards();
    // every 1 hours
    setInterval(claimAllStSRewards, 60 * 60000);
}

export async function claimAllStSRewards() {
    console.log('claiming sts rewards');
    const sftmx = await ethers.getContractAt(sonicStakingAbi, sonicStakingContract);

    const updaterBalance: BigNumber = await ethers.provider.getBalance(networkConfig.walletAddresses.relicUpdater);
    if (updaterBalance.lt(parseFixed(`2`, 18))) {
        await sendMessage(
            ChannelId.SERVER_STATUS,
            `The wallet for the stS rewardclaiming is running low. Please send S to ${inlineCode(
                networkConfig.walletAddresses.relicUpdater,
            )}!`,
        );
        return;
    }

    const backendUrl = 'https://backend-v3.beets-ftm-node.com/graphql';
    const response = (await axios.post(backendUrl, {
        query: ` query {
            stsGetGqlStakedSonicData {
                delegatedValidators {
                validatorId
                }
            }
            }`,
    })) as { data: { data: { stsGetGqlStakedSonicData: { delegatedValidators: { validatorId: string }[] } } } };

    const validatorIds = response.data.data.stsGetGqlStakedSonicData.delegatedValidators.map((v) =>
        parseFloat(v.validatorId),
    );

    try {
        // const gasPrice = await proposedGasPriceFantom();
        const maxGasPrice = 100;
        // if (parseFloat(gasPrice) < maxGasPrice) {
        const txn = await sftmx.claimRewards(validatorIds);
        await txn.wait();
        // } else {
        //     await sendMessage(
        //         ChannelId.SERVER_STATUS,
        //         `Did not claim sftmx rewards, gas price too high. Want ${maxGasPrice}, is ${gasPrice}`,
        //     );
        //     console.log(`Did not claim sftmx rewards, gas price too high. Want ${maxGasPrice}, is ${gasPrice}`);
        // }
    } catch (e) {
        console.log(`Failed to claim sts rewards: ${e}`);
        await sendMessage(ChannelId.SERVER_STATUS, `Error while claiming sts rewards: ${e}`);
    }
}
