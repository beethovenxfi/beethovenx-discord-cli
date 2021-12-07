import { BigNumber } from "ethers";

export const BASE_TEN = 10;

export function bn(amount: any, decimals: number = 18) {
  return BigNumber.from(amount).mul(BigNumber.from(BASE_TEN).pow(decimals));
}
