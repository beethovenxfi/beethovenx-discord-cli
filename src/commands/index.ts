import { farmsList } from "./farms-list";
import { CommandInteraction } from "discord.js";
import { farmsAdd } from "./farms-add";
import { timelockExecute } from "./timelock-execute";
import { timelockList } from "./timelock-list";
import { farmsEdit } from "./farms-edit";
import { timelockDelete } from "./timelock-delete";
import { farmEmissions } from "./farm-emissions";
import { bigNumberFrom } from "./big-number-from";
import { bigNumberTo } from "./big-number-to";
import { feesCollectorWithdraw } from "./fees-collector-withdraw";

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
  farmEmissions,
  timelockExecute,
  timelockList,
  timelockDelete,
  bigNumberFrom,
  bigNumberTo,
  feesCollectorWithdraw,
];
