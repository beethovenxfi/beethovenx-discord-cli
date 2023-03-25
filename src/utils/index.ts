import axios from 'axios';
import { BigNumber } from 'ethers';

export const BASE_TEN = 10;

export function bn(amount: any, decimals: number = 18) {
    return BigNumber.from(amount).mul(BigNumber.from(BASE_TEN).pow(decimals));
}

const MESSAGE_CHAR_LIMIT = 1950;

export const splitString = (val: string, prepend = '', append = ''): string[] => {
    if (val.length <= MESSAGE_CHAR_LIMIT) {
        return [val];
    }

    const splitIndex = val.lastIndexOf('\n', MESSAGE_CHAR_LIMIT - prepend.length - append.length);
    const sliceEnd = splitIndex > 0 ? splitIndex : MESSAGE_CHAR_LIMIT - prepend.length - append.length;
    const rest = splitString(val.slice(sliceEnd), prepend, append);

    return [`${val.slice(0, sliceEnd)}${append}`, `${prepend}${rest[0]}`, ...rest.slice(1)];
};

/*
API return value
{
    "status": "1",
    "message": "OK",
    "result": {
        "LastBlock": "58360583",
        "SafeGasPrice": "42.6008",
        "ProposeGasPrice": "42.6008",
        "FastGasPrice": "42.6008",
        "UsdPrice": "0.450134"
    }
}
*/

export async function proposedGasPriceFantom(): Promise<string> {
    const queryUrl = `https://api.ftmscan.com/api?module=gastracker&action=gasoracle&apikey=${process.env.ETHERSCAN_API_KEY}`;
    const result = await axios.get<{ result: { ProposeGasPrice: string } }>(queryUrl);
    return result.data.result.ProposeGasPrice;
}
