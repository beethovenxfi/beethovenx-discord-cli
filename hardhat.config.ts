import 'dotenv/config';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import { HardhatUserConfig } from 'hardhat/config';

const accounts = process.env.RELIC_UPDATER ? [`0x${process.env.RELIC_UPDATER}`] : [];

const config: HardhatUserConfig = {
    defaultNetwork: 'hardhat',
    mocha: {
        timeout: 20000,
    },

    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
    },
    networks: {
        localhost: {},
        rinkeby: {
            url: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
            chainId: 4,
        },
        fantom: {
            url: 'https://fantom.drpc.org/',
            accounts,
            chainId: 250,
            gasMultiplier: 10,
        },
        // "fantom-testnet": {
        //   url: "https://rpc.testnet.fantom.network",
        //   accounts,
        //   chainId: 4002,
        //   live: true,
        //   saveDeployments: true,
        //   tags: ["staging"],
        //   gasMultiplier: 2,
        // },
    },
    paths: {
        artifacts: 'artifacts',
        cache: 'cache',
        sources: 'contracts',
        tests: 'test',
    },
    solidity: {
        compilers: [
            {
                version: '0.8.7',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
};

export default config;
