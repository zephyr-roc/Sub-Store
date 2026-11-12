import { handleEdgeOneRequest } from './_shared/app.mjs';

export function onRequest(context) {
    return handleEdgeOneRequest(context);
}
