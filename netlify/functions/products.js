import { getProducts, json } from '../lib/data.js';

export default async () => {
  const list = await getProducts();
  return json(list.filter(p => p.active !== false));
};

export const config = { path: '/api/products' };
