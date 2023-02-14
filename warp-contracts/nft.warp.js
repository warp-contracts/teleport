(() => {
    // dist/contracts/atomic-asset-typescript/lib/utils.js
    function getOr(value, defaultVal) {
        if (value) {
            return value;
        }
        return defaultVal;
    }
    function get(value) {
        if (!value) {
            throw new ContractError(`Undefined value!`);
        }
        return value;
    }
    function Result(data) {
        return { result: data };
    }
    var isAddress = (value, name) => {
        if (!(typeof value === "string" && value !== "")) {
            throw new ContractError(`Validation error: "${name}" has to be non-empty string`);
        }
    };
    var isUInt = (value, name) => {
        if (!(typeof value === "number" && Number.isSafeInteger(value) && !Number.isNaN(value) && value >= 0)) {
            throw new ContractError(`Validation error: "${name}" has to be integer and >= 0`);
        }
    };

    // dist/contracts/atomic-asset-typescript/lib/allowance.js
    function allowance(state, owner, spender) {
        isAddress(owner, "owner");
        isAddress(spender, "spender");
        const allowance2 = getOr(getOr(state.allowances[owner], {})[spender], 0);
        return Result({
            ticker: state.symbol,
            allowance: allowance2,
            owner,
            spender
        });
    }
    function approve(state, spender, amount) {
        const caller = get(SmartWeave.caller);
        isAddress(spender, "spender");
        isUInt(amount, "amount");
        return _approve(state, caller, spender, amount);
    }
    function decreaseAllowance(state, spender, amountToSubtract) {
        const caller = get(SmartWeave.caller);
        isAddress(spender, "spender");
        isUInt(amountToSubtract, "amountToSubtract");
        const { result: { allowance: currentAllowance } } = allowance(state, caller, spender);
        if (amountToSubtract > currentAllowance) {
            throw new ContractError("Can not decrease allowance below 0");
        }
        return _approve(state, caller, spender, currentAllowance - amountToSubtract);
    }
    function increaseAllowance(state, spender, amountToAdd) {
        const caller = get(SmartWeave.caller);
        isAddress(spender, "spender");
        isUInt(amountToAdd, "amountToAdd");
        const { result: { allowance: currentAllowance } } = allowance(state, caller, spender);
        return _approve(state, caller, spender, currentAllowance + amountToAdd);
    }
    function _approve(state, owner, spender, amount) {
        if (amount > 0) {
            const ownerAllowance = getOr(state.allowances[owner], {});
            state.allowances[owner] = {
                ...ownerAllowance,
                [spender]: amount
            };
        } else {
            const ownerAllowance = state.allowances[owner];
            if (!ownerAllowance) {
                return { state };
            }
            delete state.allowances[owner][spender];
            if (Object.keys(ownerAllowance).length === 0) {
                delete state.allowances[owner];
            }
        }
        return { state };
    }

    // dist/contracts/atomic-asset-typescript/lib/balance.js
    function balanceOf(state, target) {
        var _a;
        isAddress(target, "target");
        return Result({
            balance: (_a = state.balances[target]) !== null && _a !== void 0 ? _a : 0,
            ticker: state.symbol,
            target
        });
    }
    function totalSupply(state) {
        return Result({
            value: state.totalSupply
        });
    }

    // dist/contracts/atomic-asset-typescript/lib/transfer.js
    function transfer(state, to, amount) {
        const from = get(SmartWeave.caller);
        isAddress(to, "to");
        isUInt(amount, "amount");
        return _transfer(state, from, to, amount);
    }
    function transferFrom(state, from, to, amount) {
        const caller = get(SmartWeave.caller);
        isAddress(to, "to");
        isAddress(from, "from");
        isUInt(amount, "amount");
        const { result: { allowance: allowed } } = allowance(state, from, caller);
        if (allowed < amount) {
            throw new ContractError(`Caller allowance not enough ${allowed}`);
        }
        _approve(state, from, caller, allowed - amount);
        return _transfer(state, from, to, amount);
    }
    function _transfer(state, from, to, amount) {
        const balances = state.balances;
        const fromBalance = getOr(balances[from], 0);
        if (fromBalance < amount) {
            throw new ContractError(`Caller ${from} balance not enough ${fromBalance} `);
        }
        const newFromBalance = fromBalance - amount;
        if (newFromBalance === 0) {
            delete balances[from];
        } else {
            balances[from] = newFromBalance;
        }
        let toBalance = getOr(balances[to], 0);
        balances[to] = toBalance + amount;
        _claimOwnership(state, from);
        _claimOwnership(state, to);
        return { state };
    }
    function _claimOwnership(state, potentialOwner) {
        const currentBalance = getOr(state.balances[potentialOwner], 0);
        if (currentBalance === state.totalSupply) {
            state.owner = potentialOwner;
        } else if (state.owner && currentBalance > 0) {
            state.owner = null;
        }
    }

    // dist/contracts/atomic-asset-typescript/contract/atomic-asset.js
    function handle(state, action) {
        const { input } = action;
        switch (action.input.function) {
            case FUNCTIONS.TRANSFER:
                return transfer(state, input.to, input.amount);
            case FUNCTIONS.TRANSFER_FROM:
                return transferFrom(state, input.from, input.to, input.amount);
            case FUNCTIONS.APPROVE:
                return approve(state, input.spender, input.amount);
            case FUNCTIONS.ALLOWANCE:
                return allowance(state, input.owner, input.spender);
            case FUNCTIONS.BALANCE_OF:
                return balanceOf(state, input.target);
            case FUNCTIONS.TOTAL_SUPPLY:
                return totalSupply(state);
            case FUNCTIONS.INCREASE_ALLOWANCE:
                return increaseAllowance(state, input.spender, input.amountToAdd);
            case FUNCTIONS.DECREASE_ALLOWANCE:
                return decreaseAllowance(state, input.spender, input.amountToSubtract);
            default:
                throw ContractError(`Function ${action.input.function} is not supported by this`);
        }
    }
    var FUNCTIONS;
    (function (FUNCTIONS2) {
        FUNCTIONS2["TRANSFER"] = "transfer";
        FUNCTIONS2["TRANSFER_FROM"] = "transferFrom";
        FUNCTIONS2["ALLOWANCE"] = "allowance";
        FUNCTIONS2["APPROVE"] = "approve";
        FUNCTIONS2["BALANCE_OF"] = "balanceOf";
        FUNCTIONS2["TOTAL_SUPPLY"] = "totalSupply";
        FUNCTIONS2["INCREASE_ALLOWANCE"] = "increaseAllowance";
        FUNCTIONS2["DECREASE_ALLOWANCE"] = "decreaseAllowance";
    })(FUNCTIONS || (FUNCTIONS = {}));
})();