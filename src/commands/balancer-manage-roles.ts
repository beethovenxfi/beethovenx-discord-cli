import { codeBlock, SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { ethers } from 'hardhat';
import { CommandHandler } from '.';
import { networkConfig } from '../config/config';

async function execute(interaction: CommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const authorizer = await ethers.getContractAt('Authorizer', networkConfig.contractAddresses.Authorizer);

    const targetContractName = interaction.options.getString(
        'target_contract_name',
        true,
    ) as keyof typeof networkConfig.contractAddresses;

    const contract = await ethers.getContractAt(
        targetContractName,
        networkConfig.contractAddresses[targetContractName],
    );
    const roles: string[] = interaction.options.getString('comma_seperated_roles', true).split(',');
    const roleAction = interaction.options.getString('role_action', true);
    const grantee = interaction.options.getString('grantee', true);

    const encodedRoles = [];
    for (const role of roles) {
        const selector = contract.interface.getSighash(role);
        encodedRoles.push(await contract.getActionId(selector));
    }
    const output = `Set roles on authorizer contract ${
        networkConfig.contractAddresses.Authorizer
    } on Balancer Admin multisig https://safe.fantom.network/ftm:0x9d0327954009C59eD70Dc98b7726e911879d4D92
    Data: ${authorizer.interface.encodeFunctionData(roleAction === 'grant' ? 'grantRoles' : 'revokeRoles', [
        encodedRoles,
        grantee,
    ])}`;

    await interaction.editReply({ content: codeBlock(output) });
}

export const balancerManageRoles: CommandHandler = {
    definition: new SlashCommandBuilder()
        .setName('balancer_manage_roles')
        .setDescription('Generate hex data to grant or revoke roles on balancer authorizer')
        .addStringOption((option) =>
            option
                .setName('role_action')
                .addChoices({ name: 'Grant', value: 'grant' }, { name: 'Revoke', value: 'revoke' })
                .setDescription('Grant or revoke roles')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('target_contract_name')
                .addChoices(
                    { name: 'Vault', value: 'Vault' },
                    { name: 'ProtocolFeesCollector', value: 'ProtocolFeesCollector' },
                    {
                        name: 'PoolSpecificProtocolFeePercentagesProvider',
                        value: 'PoolSpecificProtocolFeePercentagesProvider',
                    },
                    { name: 'Authorizer', value: 'Authorizer' },
                )
                .setDescription('Chose contract to grant/revoke roles on')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option.setName('grantee').setDescription('Address to grant/revoke roles to').setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('comma_seperated_roles')
                .setDescription('Comma seperated list of roles to grant/revoke')
                .setRequired(true),
        )
        .setDefaultPermission(false),
    execute,
};
