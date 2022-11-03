import { set } from 'lodash';
import { Fragment, JsonFragment, Interface, Result } from '@ethersproject/abi';
import { ethers } from 'hardhat';

export class Multicaller {
    private multiAddress: string;
    private interface: Interface;
    public options: any = {};
    private calls: [string, string, any][] = [];
    private paths: any[] = [];

    constructor(multiAddress: string, abi: string | Array<Fragment | JsonFragment | string>, options = {}) {
        this.multiAddress = multiAddress;
        this.interface = new Interface(abi);
        this.options = options;
    }

    call(path: string, address: string, functionName: string, params?: any[]): Multicaller {
        this.calls.push([address, functionName, params]);
        this.paths.push(path);
        return this;
    }

    async execute(from: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
        const obj = from;
        // not print the full exception for now, not polluting the log too much
        try {
            const results = await this.executeMulticall();
            results.forEach((result, i) => set(obj, this.paths[i], result.length > 1 ? result : result[0]));
        } catch (err) {
            console.log('multicall error', err);
            throw `Non-stacktrace multicall error`;
        }
        this.calls = [];
        this.paths = [];
        return obj;
    }

    private async executeMulticall(): Promise<Result[]> {
        const multi = await ethers.getContractAt(
            [
                'function aggregate(tuple[](address target, bytes callData) memory calls) public view returns (uint256 blockNumber, bytes[] memory returnData)',
            ],
            this.multiAddress,
        );

        const [, res] = await multi.aggregate(
            this.calls.map(([address, functionName, params]) => [
                address,
                this.interface.encodeFunctionData(functionName, params),
            ]),
            this.options,
        );

        return res.map((result: any, i: number) => this.interface.decodeFunctionResult(this.calls[i][1], result));
    }

    public get numCalls() {
        return this.calls.length;
    }
}
