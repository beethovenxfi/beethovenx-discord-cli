import { ethers } from "hardhat";
import { networkConfig } from "../config/config";
import { MasterChefOperator } from "../../masterchef-types/MasterChefOperator";
import moment from "moment";
import { ChannelId, sendMessage } from "../interactions/send-message";
import { inlineCode } from "@discordjs/builders";

const reminders: Map<number, NodeJS.Timeout> = new Map<
  number,
  NodeJS.Timeout
>();

export async function scheduleTransactionReminders() {
  console.log("scheduling transaction reminders...");
  await scheduleReminders();
  setInterval(scheduleReminders, 18000000);
}

async function scheduleReminders() {
  try {
    console.log("Checking for newly queued transactions...");
    const operator = (await ethers.getContractAt(
      "MasterChefOperator",
      networkConfig.contractAddresses.MasterChefOperator
    )) as MasterChefOperator;
    const etas = await operator.queuedFarmChangeEtas();
    const relevantEtas = [];
    for (let eta of etas) {
      const queued = await operator.usedFarmChangeEtas(eta);
      if (queued) {
        relevantEtas.push(eta);
      }
    }
    relevantEtas
      .map((eta) => moment.unix(eta.toNumber()))
      .filter((eta) => !reminders.has(eta.unix()) && eta.isAfter(moment.now()))
      .forEach((eta) => {
        const millisecondsUntilExecution = eta.diff(
          moment.now(),
          "milliseconds"
        );

        const timeoutId = setTimeout(async () => {
          await sendMessage(
            ChannelId.MULTISIG_TX,
            `@here Transaction with eta ${inlineCode(
              eta.unix().toString()
            )} ready to execute on operator ${inlineCode(
              "0x24Dce9214bA5B93B4ee7F1A7A00c9BeB1c8F709C"
            )}! MasterChef multisig: https://safe.fantom.network/#/safes/0x3Fa5c411857455e0E876412010BE600F4658Dddd/transactions`
          );
          reminders.delete(eta.unix());
        }, millisecondsUntilExecution);
        reminders.set(eta.unix(), timeoutId);
      });
  } catch (error) {
    console.error("error checking for newly queued tx", error);
  }
}
