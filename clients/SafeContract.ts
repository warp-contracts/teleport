import { Contract, Warp, CustomSignature } from "warp-contracts";

export class SafeContract {
    public readonly contract: Contract;

    constructor(
        private readonly warp: Warp,
        private readonly signer: CustomSignature,
        private readonly address: string
    ) {
        this.contract = warp.contract(
            address
        ).setEvaluationOptions(
            { internalWrites: true }
        ).connect(
            signer
        );
    }

    async call(input: Record<string, any>) {
        const response = await this.contract.writeInteraction(
            input
        );

        if (!response) {
            throw Error("No response from writing interaction");
        }

        const { cachedValue } = await this.contract.readState();

        if (!cachedValue.validity[response.originalTxId]) {
            throw Error(`Contract evaluation failed: ${cachedValue.errorMessages[response.originalTxId]}`)
        }

        return cachedValue.state;
    }

    async read(): Promise<any> {
        const { cachedValue } = await this.contract.readState();
        return cachedValue.state;
    }
}