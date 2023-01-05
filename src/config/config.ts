import { network } from 'hardhat';

type CliNetworkConfigContent = {
    contractAddresses: {
        MasterChef: string;
        MasterChefOperator: string;
        MasterChefRewarderFactory: string;
        Timelock: string;
        BeethovenxToken: string;
        BeetsLp: string;
        TeamVesting: string;
        ProtocolFeesCollector: string;
        Reliquary: string;
        ReliquaryBeetsStreamer: string;
        multicall: string;
        Authorizer: string;
        Vault: string;
    };
    walletAddresses: {
        treasury: string;
        partnership: string;
        team: string;
        relicUpdater: string;
    };
};

type NetworkConfig = Record<number, CliNetworkConfigContent>;

export const scriptConfig: NetworkConfig = {
    250: {
        contractAddresses: {
            MasterChef: '0x8166994d9ebBe5829EC86Bd81258149B87faCfd3',
            MasterChefOperator: '0x24Dce9214bA5B93B4ee7F1A7A00c9BeB1c8F709C',
            MasterChefRewarderFactory: '0xF3906b1c590fDE35675f53Be529eF5C6639AD5dc',
            Timelock: '0xb5caee3cd5d86c138f879b3abc5b1bebb63c6471',
            BeethovenxToken: '0xF24Bcf4d1e507740041C9cFd2DddB29585aDCe1e',
            BeetsLp: '0x03c6B3f09D2504606936b1A4DeCeFaD204687890',
            TeamVesting: '0xa2503804ec837D1E4699932D58a3bdB767DeA505',
            ProtocolFeesCollector: '0xC6920d3a369E7c8BD1A22DbE385e11d1F7aF948F',
            Reliquary: '0x1ed6411670c709F4e163854654BD52c74E66D7eC',
            ReliquaryBeetsStreamer: '0xC8e3f0fC248F3A734d69045cf5174EC02173b5d0',
            multicall: '0x66335d7ad8011f6aa3f48aadcb523b62b38ed961',
            Authorizer: '0x974D3FF709D84Ba44cde3257C0B5B0b14C081Ce9',
            Vault: '0x20dd72Ed959b6147912C2e529F0a0C651c33c9ce',
        },
        walletAddresses: {
            treasury: '0xa1e849b1d6c2fd31c63eef7822e9e0632411ada7',
            partnership: '0x69739a7618469EED0685330d164D50Ac19A9411a',
            team: '0x0EDfcc1b8D082Cd46d13Db694b849D7d8151C6D5',
            relicUpdater: '0xFaC37371dFAFbfA0937DF84532D1EDED08b21718',
        },
    },
    4: {
        contractAddresses: {
            MasterChef: '0x64CBF3dbee116167Dd41Abd143405B511c436076',
            MasterChefOperator: '0xF6F17Fa57c2172999BfE6DDF809b6986C4CA33e9',
            MasterChefRewarderFactory: '',
            Timelock: '0xa2f273656b1989d10fA36274Ca9c3c851D4f1928',
            BeethovenxToken: '0x51929Da9218898b4dfaB4AE5Db56b0A61158A613',
            BeetsLp: '0x33276d43ada054a281d40a11d48310cdc0156fc2',
            TeamVesting: '',
            ProtocolFeesCollector: '0x45384d59dA6748d7C21200c80893634d5CA980CD',
            Reliquary: '',
            ReliquaryBeetsStreamer: '',
            multicall: '',
            Vault: '',
            Authorizer: '',
        },
        walletAddresses: {
            treasury: '',
            partnership: '',
            team: '',
            relicUpdater: '',
        },
    },
};

export const networkConfig = scriptConfig[network.config.chainId!];
export const MODERATOR_ROLE = '886027958257594379';
