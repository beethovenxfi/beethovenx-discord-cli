import { codeBlock, inlineCode, SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { CommandHandler } from './index';
import { splitString } from '../utils';
import axios from 'axios';
import _ from 'lodash';

type MoralisTokenBalance = {
    token_address: string;
    decimals: number;
    balance: string;
    symbol: string;
    name: string;
};

type TokenValue = {
    tokenAddress: string;
    decimals: number;
    totalValueUSD: number;
    balance: string;
    symbol: string;
    name: string;
};

async function execute(interaction: CommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const thresholdUSDInput = interaction.options.getString('threshold_usd', true)!;
    const chainInput = interaction.options.getString('chain', true);

    const allTokenValues: TokenValue[] = [];
    let tokenWithoutPriceData = '';
    if (chainInput === 'ftm') {
        const requestURL =
            'https://deep-index.moralis.io/api/v2/0xC6920d3a369E7c8BD1A22DbE385e11d1F7aF948F/erc20?chain=0xfa';
        const response = await axios.get(requestURL, {
            headers: {
                'x-api-key': `${process.env.MORALIS_API_KEY}`,
            },
        });
        const tokenBalances: MoralisTokenBalance[] = response.data;
        for (const tokenBalance of tokenBalances) {
            allTokenValues.push({
                tokenAddress: tokenBalance.token_address,
                decimals: tokenBalance.decimals,
                totalValueUSD: 0,
                balance: tokenBalance.balance,
                symbol: tokenBalance.symbol,
                name: tokenBalance.name,
            });
        }
        const tokensWithoutPrice = await insertUSDValue(allTokenValues, 'fantom');
        for (const tokenWithoutPrice of tokensWithoutPrice) {
            tokenWithoutPriceData += `Token Symbol: ${tokenWithoutPrice.symbol}
Token address: ${tokenWithoutPrice.tokenAddress}
Token balance: ${parseInt(tokenWithoutPrice.balance) / 10 ** tokenWithoutPrice.decimals}
`;
        }
    }

    const tokensToWithdraw = allTokenValues.filter(
        (tokenValue) => tokenValue.totalValueUSD >= parseFloat(thresholdUSDInput),
    );

    await interaction.editReply({ content: inlineCode('Token names to withdraw, please check:') });
    let tokenNameData = '';
    let tokenAddressData = '';
    for (const token of tokensToWithdraw) {
        tokenNameData += `${token.symbol}: ${parseInt(token.balance) / 10 ** token.decimals}, `;
        tokenAddressData += `${token.tokenAddress},`;
    }
    await interaction.followUp({
        content: codeBlock(`Proposing to withdraw the following token amounts:`),
        ephemeral: true,
    });
    if (tokenNameData.length < 2000) {
        await interaction.followUp({
            content: codeBlock(`${tokenNameData}`),
            ephemeral: true,
        });
    } else {
        const splits = splitString(tokenNameData);
        for (let split of splits) {
            await interaction.followUp({
                content: codeBlock(split),
                ephemeral: true,
            });
        }
    }

    if (tokenAddressData.length < 2000) {
        await interaction.followUp({
            content: codeBlock(tokenAddressData),
            ephemeral: true,
        });
    } else {
        const splits = splitString(tokenAddressData);
        for (let split of splits) {
            await interaction.followUp({
                content: codeBlock(split),
                ephemeral: true,
            });
        }
    }
    await interaction.followUp({
        content: codeBlock(`Could not find a price for the following tokens:`),
        ephemeral: true,
    });
    if (tokenWithoutPriceData.length < 2000) {
        await interaction.followUp({
            content: codeBlock(tokenWithoutPriceData),
            ephemeral: true,
        });
    } else {
        const splits = splitString(tokenWithoutPriceData);
        for (let split of splits) {
            await interaction.followUp({
                content: codeBlock(split),
                ephemeral: true,
            });
        }
    }
}

type TokenPrices = { [address: string]: Price };
type Price = { usd: number };

async function insertUSDValue(tokenValues: TokenValue[], platform: 'fantom' | 'optimism'): Promise<TokenValue[]> {
    const tokensWithoutprice = [];
    const allContractAddresses = tokenValues.map((token) => token.tokenAddress);
    const pagedTokenPrices: TokenPrices[] = [];
    const chunks = _.chunk(allContractAddresses, 100);
    let backendUrl = '';
    if (platform === 'fantom') {
        backendUrl = 'https://backend-v2.beets-ftm-node.com/graphql';
    } else {
        backendUrl = 'https://backend-optimism-v2.beets-ftm-node.com/graphql';
    }
    const allPools = await axios.post(backendUrl, {
        query: ` query {
          poolGetPools{
            address
            dynamicData{
            totalShares
              totalLiquidity
            }
          }
        }`,
    });
    for (const chunk of chunks) {
        const response = await axios.get(
            `https://api.coingecko.com/api/v3/simple/token_price/${platform}?vs_currencies=usd&contract_addresses=` +
                chunk.join(','),
        );
        pagedTokenPrices.push(response.data);
    }
    const allTokenPrices = pagedTokenPrices.reduce((result, page) => ({ ...result, ...page }), {});
    for (const token of tokenValues) {
        let foundPrice = false;
        if (allTokenPrices[token.tokenAddress]) {
            token.totalValueUSD =
                (parseInt(token.balance) / 10 ** token.decimals) * allTokenPrices[token.tokenAddress].usd;
        } else {
            // try to get BPT prices
            for (const pool of allPools.data.data.poolGetPools) {
                if (pool.address.toLowerCase() === token.tokenAddress.toLowerCase()) {
                    const tokenPrice =
                        parseFloat(pool.dynamicData.totalLiquidity) / parseFloat(pool.dynamicData.totalShares);
                    token.totalValueUSD = (parseInt(token.balance) / 10 ** token.decimals) * tokenPrice;
                    foundPrice = true;
                }
            }
            if (!foundPrice) {
                console.log(
                    `Can't find price for ${token.symbol}(${token.tokenAddress}). Balance: ${
                        parseInt(token.balance) / 10 ** token.decimals
                    }`,
                );
                tokensWithoutprice.push(token);
            }
        }
    }
    return tokensWithoutprice;
}

export const feesCollectorTokenlist: CommandHandler = {
    definition: new SlashCommandBuilder()
        .setName('protocol_fees_generate_tokenlist')
        .setDescription('Generate tokenlist for protocol fee withdraw')
        .addStringOption((option) =>
            option
                .setName('threshold_usd')
                .setDescription('Minimum USD value of token balance to withdraw')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('chain')
                .addChoices({ name: 'Optimism', value: 'op' }, { name: 'Fantom', value: 'ftm' })
                .setDescription('Choose the chain')
                .setRequired(true),
        ),
    execute,
};
