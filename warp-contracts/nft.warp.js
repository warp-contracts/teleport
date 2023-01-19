function revert(message) {
    throw new ContractError(message)
}

export function handle(state, action) {
    const { input } = action;
    switch (input.function) {
        case 'mint':
            return mint(action.caller, state, input);
        case 'transfer':
            return transfer(action.caller, state, input);
        case 'ownerOf':
            return ownerOf(state, input);
        default:
            revert(`NFT: unknown function ${input.function}`)
    }
}

function transfer(signer, state, input) {
    const to = get(input.to)
    const tokenId = get(input.tokenId)

    const token = state[tokenId];

    if (!token) {
        revert(`token ${tokenId} doesn't exist`);
    }

    if (token.owner !== signer) {
        revert(`only owner can transfer`);
    }

    token.owner = to;

    return { state };
}

function mint(signer, state, input) {
    const content = get(input.content);
    const newTokenId = Number.parseInt(state.idCounter) + 1;
    state.idCounter = newTokenId.toString();

    state[newTokenId] = { content, owner: signer };

    return { state };
}

function ownerOf(state, input) {
    const tokenId = get(input.tokenId);

    const token = state[tokenId];

    if (!token) {
        revert(`token ${tokenId} doesn't exist`);
    }

    return { result: token.owner };
}

function get(value) {
    if (!value) {
        revert('Value not defined');
    }
    return value;
}