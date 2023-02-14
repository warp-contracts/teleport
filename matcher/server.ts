import Koa from 'koa';
import { EventEmitter } from 'node:events';
import json from 'koa-bodyparser';
import cors from '@koa/cors';
import * as log from './logger';

export function buildServer(emitter: EventEmitter) {
    const koa = new Koa();

    koa.use(json())
    koa.use(cors())
    koa.use(ctx => {
        if (ctx.request.method !== 'POST') {
            ctx.status = 404;
            return;
        }

        const { op } = (ctx.request.body as any);

        switch (op) {
            case 'trackBuyer': {
                log.info(`Handling request trackBuyer ${JSON.stringify(ctx.request.body)}`)
                const { password, offerId, from } = (ctx.request.body as any);

                //TODO: pass with signature and then verify it
                if (!password || !offerId || !from) {
                    ctx.body = 'Wrong params, provide: password and offerId and escrowId'
                    ctx.status = 400;
                    return;
                }

                emitter.emit('trackBuyer', { offerId, password, from })
                ctx.status = 200;
                return;
            }
            case 'trackSeller': {
                log.info(`Handling request trackSeller${JSON.stringify(ctx.request.body)}`)
                const { offerId } = (ctx.request.body as any);

                if (!offerId) {
                    ctx.body = 'Wrong params, provide: password and offerId and escrowId'
                    ctx.status = 400;
                    return;
                }

                emitter.emit('trackSeller', { offerId });
                ctx.status = 200;
                return;
            }
            default:
                ctx.status = 404;
                return;
        }


    });

    return koa;
}

