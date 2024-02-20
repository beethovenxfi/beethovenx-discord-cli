import ftmstakingAbi from '../../abi/FTMStaking.json';
const { ethers } = require('hardhat');

const ftmStakingContract = '0xB458BfC855ab504a8a327720FcEF98886065529b';

export async function claimSftmxRewards() {
    console.log('Schedule claim sftmx rewards');
    await claimAllSftmxRewards();
    // every 24 hours
    setInterval(claimAllSftmxRewards, 24 * 60 * 60000);
}

async function claimAllSftmxRewards() {
    console.log('claiming sftmx rewards');
    const sftmx = await ethers.getContractAt(ftmstakingAbi, ftmStakingContract);
    const txn = await sftmx.claimRewardsAll();
    await txn.wait();
}
