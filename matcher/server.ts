import Koa from 'koa';
import { EventEmitter } from 'node:events';
import json from 'koa-bodyparser';

export function buildServer(emitter: EventEmitter) {
    const koa = new Koa();

    koa.use(json())
    koa.use(ctx => {
        if (ctx.request.method !== 'POST') {
            ctx.status = 404;
            return;
        }
        const { password, offerId, from } = (ctx.request.body as any);

        if (!password || !offerId || !from) {
            ctx.body = 'Wrong params, provide: password and offerId and escrowId'
            ctx.status = 400;
            return;
        }

        emitter.emit('newPassword', { offerId, password, from })

        ctx.status = 200;
    });

    return koa;
}

