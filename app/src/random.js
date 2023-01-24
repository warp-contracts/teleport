export async function getRandomValue(bytes = 32) {
    const space = new Uint8Array(bytes);
    const randomBytes = crypto.getRandomValues(space);

    return randomBytes;
}

export function encodeBytes(u8a) {
    return [...u8a]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
}


