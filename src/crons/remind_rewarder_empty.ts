import { ethers } from "hardhat";
import { ChannelId, sendMessage } from "../interactions/send-message";
import { inlineCode } from "@discordjs/builders";
import fs from "fs";
import path from "path";
import { ERC20 } from "../../masterchef-types";
import { TimeBasedMasterChefRewarder } from "../../masterchef-types/TimeBasedMasterChefRewarder";
import moment from "moment";

export async function notifiyEmptyRewarders() {
  console.log("checking for empty rewarders");
  setInterval(checkEmptyRewarders, 43200000);
}

async function checkEmptyRewarders() {
  console.log("Checking for newly added rewarders...");

  const rewarders: string[] = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, `../../.rewarder/rewarder-list.json`),
      "utf-8"
    )
  );
  for (let rewarderAddress of rewarders) {
    const rewarder = (await ethers.getContractAt(
      "TimeBasedMasterChefRewarder",
      rewarderAddress
    )) as TimeBasedMasterChefRewarder;

    const rewardToken = await rewarder.rewardToken();
    const erc20 = (await ethers.getContractAt("ERC20", rewardToken)) as ERC20;
    const balance = await erc20.balanceOf(rewarder.address);
    const rewardPerSecond = await rewarder.rewardPerSecond();

    const seconds = balance.div(rewardPerSecond);
    if (seconds.eq(0)) {
      await sendMessage(
        ChannelId.MULTISIG_TX,
        `@here Rewarder ${inlineCode(rewarderAddress)} is empty!
        `
      );
    } else {
      const estimatedEndOfRewards = moment().add(seconds.toNumber(), "seconds");
      const days = estimatedEndOfRewards.diff(moment(), "days");
      if (days < 5) {
        await sendMessage(
          ChannelId.MULTISIG_TX,
          `@here Rewarder ${inlineCode(
            rewarderAddress
          )} running empty in under 2 days! 
        Remaining reward tokens: ${inlineCode(
          ethers.utils.formatUnits(balance)
        )} ${await erc20.symbol()}
        Estimated end of rewards: ${estimatedEndOfRewards.toISOString()} 
        `
        );
      }
    }
  }
}
