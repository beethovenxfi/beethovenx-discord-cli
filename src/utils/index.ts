import { BigNumber } from "ethers";

export const BASE_TEN = 10;

export function bn(amount: any, decimals: number = 18) {
  return BigNumber.from(amount).mul(BigNumber.from(BASE_TEN).pow(decimals));
}

const MESSAGE_CHAR_LIMIT = 1950;

export const splitString = (
  val: string,
  prepend = "",
  append = ""
): string[] => {
  if (val.length <= MESSAGE_CHAR_LIMIT) {
    return [val];
  }

  const splitIndex = val.lastIndexOf(
    "\n",
    MESSAGE_CHAR_LIMIT - prepend.length - append.length
  );
  const sliceEnd =
    splitIndex > 0
      ? splitIndex
      : MESSAGE_CHAR_LIMIT - prepend.length - append.length;
  const rest = splitString(val.slice(sliceEnd), prepend, append);

  return [
    `${val.slice(0, sliceEnd)}${append}`,
    `${prepend}${rest[0]}`,
    ...rest.slice(1),
  ];
};
