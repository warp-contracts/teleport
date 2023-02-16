
import WebSocket from 'ws';
import { initPubSub, subscribe } from "warp-contracts-pubsub";
import * as log from './logger';

global.WebSocket = WebSocket as any;
initPubSub();



export async function subscribeState(
    contractId: string,
    onMessage: (state: Record<string, any>) => Promise<void> | void,
) {
    await subscribe(`states/${contractId}`,
        ({ data }: { data: string }) => {
            const { state } = JSON.parse(data);
            onMessage(state);
        },
        (e: any) => log.error(e.error.errors)
    )
} 