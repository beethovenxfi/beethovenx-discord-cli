import path from "path";
import fs from "fs";
import { ethers, network } from "hardhat";
import moment from "moment";
import { config } from "../config/config";
import { ChannelId, sendMessage } from "../interactions/send-message";
import { codeBlock } from "@discordjs/builders";

export type TimelockTransaction = {
  targetContract: {
    name: string;
    address: string;
  };
  targetFunction: {
    identifier: string;
    args: any[];
  };
  // eth sent with transaction
  value: number;
  eta: number; // in unix seconds
};
export type TimelockTransactionAction = "queue" | "execute";

export type StoredTimelockTransaction = TimelockTransaction & {
  queueTxHash?: string;
  executed: boolean;
  executeTxHash?: string;
};

export type HexContractInteraction = {
  contract: string;
  data: string;
};

const timelockReminders: Map<string, NodeJS.Timeout> = new Map<
  string,
  NodeJS.Timeout
>();

export async function queueTimelockTransaction(
  transaction: TimelockTransaction
): Promise<HexContractInteraction> {
  const timelockContract = await ethers.getContractAt(
    "Timelock",
    config.contractAddresses.Timelock
  );
  const targetContract = await ethers.getContractAt(
    transaction.targetContract.name,
    transaction.targetContract.address
  );

  // encode function data with params
  const functionFragment = targetContract.interface.getFunction(
    transaction.targetFunction.identifier
  );
  const data = targetContract.interface.encodeFunctionData(
    functionFragment,
    transaction.targetFunction.args
  );

  const timelockFunctionFragment =
    timelockContract.interface.getFunction("queueTransaction");

  const transactionId = storeQueuedTransaction(transaction);

  const reminderDuration = (transaction.eta - moment().unix()) * 1000;
  const reminderId = setTimeout(async () => {
    const contractInteraction = await executeTimelockTransaction(transactionId);
    await sendMessage(
      ChannelId.MULTISIG_TX,
      "@here Transaction ready to execute:" +
        codeBlock(
          `
      Contract: ${contractInteraction.contract}
      Data: ${contractInteraction.data}`
        )
    );
  }, reminderDuration);

  timelockReminders.set(transactionId, reminderId);

  return {
    contract: timelockContract.address,
    data: timelockContract.interface.encodeFunctionData(
      timelockFunctionFragment,
      [
        transaction.targetContract.address,
        transaction.value,
        0,
        data,
        transaction.eta,
      ]
    ),
  };
}

export async function executeTimelockTransaction(
  transactionId: string
): Promise<HexContractInteraction> {
  const storedTransactions = getStoredTransactions();
  const transaction = storedTransactions[transactionId];
  const timelockContract = await ethers.getContractAt(
    "Timelock",
    config.contractAddresses.Timelock
  );
  const targetContract = await ethers.getContractAt(
    transaction.targetContract.name,
    transaction.targetContract.address
  );

  // encode function data with params
  const functionFragment = targetContract.interface.getFunction(
    transaction.targetFunction.identifier
  );
  const data = targetContract.interface.encodeFunctionData(
    functionFragment,
    transaction.targetFunction.args
  );

  const timelockFunctionFragment =
    timelockContract.interface.getFunction("executeTransaction");

  markExecutedTransaction(transactionId);

  return {
    contract: timelockContract.address,
    data: timelockContract.interface.encodeFunctionData(
      timelockFunctionFragment,
      [
        transaction.targetContract.address,
        transaction.value,
        0,
        data,
        transaction.eta,
      ]
    ),
  };
}

function storeQueuedTransaction(transaction: TimelockTransaction) {
  const storedTimelockTransaction: StoredTimelockTransaction = {
    ...transaction,
    executed: false,
  };
  const storedTransactions = getStoredTransactions();

  const lastId =
    Object.keys(storedTransactions)
      .map((val) => parseInt(val))
      .pop() ?? 0;

  const nextId = lastId + 1;

  fs.writeFileSync(
    path.join(
      __dirname,
      `../../.timelock/transactions-discord.${network.name}.json`
    ),
    JSON.stringify({
      ...storedTransactions,
      [nextId]: storedTimelockTransaction,
    })
  );

  return nextId.toString();
}

export function deleteTransaction(transactionId: string) {
  const storedTransactions = getStoredTransactions();
  delete storedTransactions[transactionId];
  fs.writeFileSync(
    path.join(
      __dirname,
      `../../.timelock/transactions-discord.${network.name}.json`
    ),
    JSON.stringify(storedTransactions)
  );
  const timeoutId = timelockReminders.get(transactionId);
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
}

function markExecutedTransaction(transactionId: string) {
  const storedTransactions: Record<
    string,
    StoredTimelockTransaction
    // eslint-disable-next-line @typescript-eslint/no-var-requires
  > = getStoredTransactions();

  const transaction = storedTransactions[transactionId];
  fs.writeFileSync(
    path.join(
      __dirname,
      `../../.timelock/transactions-discord.${network.name}.json`
    ),
    JSON.stringify({
      ...storedTransactions,
      [transactionId]: {
        ...transaction,
        executed: true,
      },
    })
  );
}

export function getTimelockTransactions(onlyExecutable = true) {
  const storedTransactions = getStoredTransactions();
  let transactionIds = [];
  if (onlyExecutable) {
    transactionIds = Object.keys(storedTransactions).filter((transactionId) => {
      return (
        !storedTransactions[transactionId].executed &&
        moment().isSameOrAfter(
          moment.unix(storedTransactions[transactionId].eta)
        )
      );
    });
  } else {
    transactionIds = Object.keys(storedTransactions);
  }

  return transactionIds.map((id) => ({
    id,
    transaction: storedTransactions[id],
  }));
}

function getStoredTransactions() {
  const storedTransactions: Record<
    string,
    StoredTimelockTransaction
    // eslint-disable-next-line @typescript-eslint/no-var-requires
  > = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        `../../.timelock/transactions-discord.${network.name}.json`
      ),
      "utf-8"
    )
  );
  return storedTransactions;
}
