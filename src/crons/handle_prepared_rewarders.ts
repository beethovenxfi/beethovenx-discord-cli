import { ethers } from "hardhat";
import { networkConfig } from "../config/config";
import { ChannelId, sendMessage } from "../interactions/send-message";
import { inlineCode } from "@discordjs/builders";
import { MasterChefRewarderFactory } from "../../masterchef-types/MasterChefRewarderFactory";
import fs from "fs";
import path from "path";

export async function notifiyPreparedRewarders() {
  console.log("scheduling rewarder factory handler...");
  await checkForNewRewarders();
  setInterval(checkForNewRewarders, 300000);
}

async function checkForNewRewarders() {
  console.log("Checking for newly added rewarders...");

  const lastVerifiedDeployment: { id: number } = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, `../../.rewarder/last_verified_deployment.json`),
      "utf-8"
    )
  );

  const rewarderFactory = (await ethers.getContractAt(
    "MasterChefRewarderFactory",
    networkConfig.contractAddresses.MasterChefRewarderFactory
  )) as MasterChefRewarderFactory;

  const deploymentCount = await rewarderFactory.rewarderDeploymentLength();
  const lastDeploymentId = deploymentCount.toNumber() - 1;
  console.log("last deployment id", lastDeploymentId);
  console.log("last verified deployment id", lastVerifiedDeployment);

  if (lastVerifiedDeployment.id < lastDeploymentId) {
    for (
      let deploymentId = lastVerifiedDeployment.id + 1;
      deploymentId <= lastDeploymentId;
      deploymentId++
    ) {
      console.log("Trying to verify rewarder for deployment ID", deploymentId);
      const config = await rewarderFactory.rewarderConfigs(deploymentId);
      const rewarderAddress = await rewarderFactory.deployedRewarders(
        deploymentId
      );
      await sendMessage(
        ChannelId.MULTISIG_TX,
        `@here New rewarder with deploymentId ${inlineCode(
          String(deploymentId)
        )} ready to approve:
        Address: ${inlineCode(rewarderAddress)}
        LP: ${inlineCode(config.lpToken)}
        Reward token: ${config.rewardToken}
        
        Approve on reward factory ${inlineCode(
          networkConfig.contractAddresses.MasterChefRewarderFactory
        )}! with MasterChef multisig: https://safe.fantom.network/#/safes/0x3Fa5c411857455e0E876412010BE600F4658Dddd/transactions`
      );
      fs.writeFileSync(
        path.join(__dirname, `../../.rewarder/last_verified_deployment.json`),
        JSON.stringify({
          id: deploymentId,
        })
      );
    }
  }
}
