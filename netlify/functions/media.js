import { getMedia } from '../lib/data.js';

export default async (req, context) => {
  const m = await getMedia(context.params.key);
  if (!m) return new Response('Not found', { status: 404 });
  return new Response(m.data, {
    status: 200,
    headers: { 'content-type': m.contentType, 'cache-control': 'public, max-age=31536000, immutable' }
  });
};

export const config = { path: '/api/media/:key' };
