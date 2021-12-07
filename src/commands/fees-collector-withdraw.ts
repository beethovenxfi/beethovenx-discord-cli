import { codeBlock, SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { CommandHandler } from "./index";
import { MODERATOR_ROLE, networkConfig } from "../config/config";
import { ethers } from "hardhat";

async function execute(interaction: CommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const tokensInput = interaction.options.getString("tokens")!;
  const tokens = tokensInput.split(",");
  const recipient = interaction.options.getString("recipient")!;

  const feesCollector = await ethers.getContractAt(
    "ProtocolFeesCollector",
    networkConfig.contractAddresses.ProtocolFeesCollector
  );

  const amounts = await feesCollector.getCollectedFeeAmounts(tokens);

  let tokenContent = "";

  for (let index = 0; index < tokens.length; index++) {
    const erc20 = await ethers.getContractAt("ERC20", tokens[index]);
    tokenContent += `
    Token: ${await erc20.symbol()}
    Amount: ${ethers.utils.formatUnits(amounts[index], await erc20.decimals())}
    
    ----------------------------------------------------
    `;
  }
  tokenContent += `
    Contract: ${feesCollector.address}
    Data: ${feesCollector.interface.encodeFunctionData(
      "withdrawCollectedFees",
      [tokens, amounts, recipient]
    )}
  `;

  await interaction.editReply({
    content: codeBlock(tokenContent),
  });
}

export const feesCollectorWithdraw: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("protocol_fees_withdraw")
    .setDescription("Withdraw collected protocol fees")
    .addStringOption((option) =>
      option
        .setName("tokens")
        .setDescription("Comma seperated list of token addresses")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("recipient")
        .setDescription("Recipient address")
        .setRequired(true)
    )
    .setDefaultPermission(false),
  execute,
  permissionRoles: [MODERATOR_ROLE],
};
