import { farmsList } from "./farms-list";
import { CommandInteraction } from "discord.js";
import { farmsAdd } from "./farms-add";
import { timelockExecute } from "./timelock-execute";
import { timelockList } from "./timelock-list";
import { farmsEdit } from "./farms-edit";
import { timelockDelete } from "./timelock-delete";

export type CommandExecutor = (interaction: CommandInteraction) => Promise<any>;
export type CommandHandler = {
  definition: any;
  execute: CommandExecutor;
};

export const commandHandlers = [
  farmsList,
  farmsAdd,
  farmsEdit,
  timelockExecute,
  timelockList,
  timelockDelete,
];
