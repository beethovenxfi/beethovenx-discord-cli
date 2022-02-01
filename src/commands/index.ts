import { farmsList } from "./farms-list";
import { CommandInteraction } from "discord.js";
import { farmsAdd } from "./farms-add";
import { timelockExecute } from "./timelock-execute";
import { timelockList } from "./timelock-list";
import { farmsEdit } from "./farms-edit";
import { timelockDelete } from "./timelock-delete";
import { farmsEmissions } from "./farms-emissions";
import { bigNumberFrom } from "./big-number-from";
import { bigNumberTo } from "./big-number-to";
import { feesCollectorWithdraw } from "./fees-collector-withdraw";
import { farmsEmissionsChange } from "./farms-emissions-change";
import { timelockSetPendingAdmin } from "./timelock-set-pending-admin";
import { keccak256 } from "./keccak256";
import { abiEncode } from "./abi-encode";

export type CommandExecutor = (interaction: CommandInteraction) => Promise<any>;
export type CommandHandler = {
  definition: any;
  execute: CommandExecutor;
  permissionRoles?: string[];
};

export const commandHandlers = [
  farmsList,
  farmsAdd,
  farmsEdit,
  farmsEmissions,
  farmsEmissionsChange,
  timelockExecute,
  timelockList,
  timelockDelete,
  timelockSetPendingAdmin,
  bigNumberFrom,
  bigNumberTo,
  keccak256,
  abiEncode,
  feesCollectorWithdraw,
];
