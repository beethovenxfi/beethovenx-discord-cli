import { BigNumber } from 'ethers';
import { parseFixed } from '@ethersproject/bignumber';
import sonicStakingAbi from '../../abi/SonicStaking.json';
import { proposedGasPriceFantom } from '../utils';
import { ChannelId, sendMessage } from '../interactions/send-message';
import { networkConfig } from '../config/config';
import { inlineCode } from '@discordjs/builders';
const { ethers } = require('hardhat');

const sonicStakingContract = '0xe5da20f15420ad15de0fa650600afc998bbe3955';

export async function claimStsRewards() {
    console.log('Schedule claim sftmx rewards');
    await claimAllSftmxRewards();
    // every 1 hours
    setInterval(claimAllSftmxRewards, 60 * 60000);
}

async function claimAllSftmxRewards() {
    console.log('claiming sts rewards');
    const sftmx = await ethers.getContractAt(sonicStakingAbi, sonicStakingContract);

    const updaterBalance: BigNumber = await ethers.provider.getBalance(networkConfig.walletAddresses.relicUpdater);
    if (updaterBalance.lt(parseFixed(`1`, 18))) {
        return;
    }

    try {
        // const gasPrice = await proposedGasPriceFantom();
        const maxGasPrice = 100;
        // if (parseFloat(gasPrice) < maxGasPrice) {
        const txn = await sftmx.claimRewards([1, 15, 16, 17, 18, 24, 29, 30]);
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
