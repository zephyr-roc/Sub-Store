// The management UI is hosted separately by the Sub-Store project.
export function onRequest() {
    return Response.redirect('https://sub-store.vercel.app/', 302);
}
