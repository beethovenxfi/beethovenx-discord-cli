import { farmsList } from './farms-list';
import { CommandInteraction } from 'discord.js';
import { farmsAdd } from './farms-add';
import { timelockExecute } from './timelock-execute';
import { timelockList } from './timelock-list';
import { farmsEdit } from './farms-edit';
import { timelockDelete } from './timelock-delete';
import { farmsEmissions } from './farms-emissions';
import { bigNumberFrom } from './big-number-from';
import { bigNumberTo } from './big-number-to';
import { feesCollectorWithdraw } from './fees-collector-withdraw';
import { farmsEmissionsChange } from './farms-emissions-change';
import { timelockSetPendingAdmin } from './timelock-set-pending-admin';
import { keccak256 } from './keccak256';
import { abiEncode } from './abi-encode';
import { farmsChangesForEta } from './farms-changes-for-eta';
import { farmsChangeEtas } from './farms-change-etas';
import { rewarderFactoryDeployment } from './rewarder-factory-deployment';
import { farmsChangeEtaQueued } from './farms-change-is-eta-queued';
import { rewarderStats } from './rewarder-stats';
import { rewarderAddTopUpReminder } from './rewarder-add-topup-reminder';
import { rewarderRemoveTopUpReminder } from './rewarder-remove-topup-reminder';
import { rewarderListTracked } from './rewarder-list-tracked-rewarders';
import { checkReliquaryRate } from './check-reliquary-rate';
import { balancerManageRoles } from './balancer-manage-roles';
import { feesCollectorTokenlist } from './fees-withdraw-token-list';

export type CommandExecutor = (interaction: CommandInteraction) => Promise<any>;
export type CommandHandler = {
    definition: any;
    execute: CommandExecutor;
};

export const commandHandlers = [
    farmsList,
    farmsAdd,
    farmsEdit,
    farmsEmissions,
    farmsEmissionsChange,
    farmsChangeEtas,
    farmsChangeEtaQueued,
    farmsChangesForEta,
    timelockExecute,
    timelockList,
    timelockDelete,
    timelockSetPendingAdmin,
    bigNumberFrom,
    bigNumberTo,
    keccak256,
    abiEncode,
    feesCollectorWithdraw,
    feesCollectorTokenlist,
    rewarderFactoryDeployment,
    rewarderStats,
    rewarderAddTopUpReminder,
    rewarderRemoveTopUpReminder,
    rewarderListTracked,
    checkReliquaryRate,
    balancerManageRoles,
];
