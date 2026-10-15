import { test } from 'node:test';
import assert from 'node:assert/strict';

// sessionStorage cuma ada di browser. Tiru API-nya secukupnya (Map di belakang)
// supaya savePendingOrder/loadPendingOrder/clearPendingOrder di
// public/js/checkout-pending.js bisa dites langsung sebagai fungsi murni.
function makeMockStorage() {
  const store = new Map();
  return {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  };
}
globalThis.sessionStorage = makeMockStorage();

import '../public/js/checkout-pending.js';
const { savePendingOrder, loadPendingOrder, clearPendingOrder } = globalThis.CheckoutPending;

test('loadPendingOrder: tidak ada pesanan tersimpan -> null', () => {
  globalThis.sessionStorage = makeMockStorage();
  assert.equal(loadPendingOrder(), null);
});

test('savePendingOrder lalu loadPendingOrder: mengembalikan code & total, bukan field lain', () => {
  globalThis.sessionStorage = makeMockStorage();
  savePendingOrder({ code: 'RR260722-AB12', total: 150000, id: 'o_abc', paymentProof: 'harus-tidak-ikut' });
  assert.deepEqual(loadPendingOrder(), { code: 'RR260722-AB12', total: 150000 });
});

test('clearPendingOrder: setelah dihapus, loadPendingOrder balik null', () => {
  globalThis.sessionStorage = makeMockStorage();
  savePendingOrder({ code: 'RR260722-CD34', total: 99000 });
  assert.ok(loadPendingOrder());
  clearPendingOrder();
  assert.equal(loadPendingOrder(), null);
});

test('loadPendingOrder: data rusak di storage -> null, bukan crash', () => {
  const s = makeMockStorage();
  s.setItem('rrhc_pending_order', '{bukan json valid');
  globalThis.sessionStorage = s;
  assert.equal(loadPendingOrder(), null);
});

test('savePendingOrder: sessionStorage error (mis. mode privat penuh) -> tidak melempar', () => {
  globalThis.sessionStorage = {
    setItem: () => { throw new Error('QuotaExceededError'); },
    getItem: () => null,
    removeItem: () => {},
  };
  assert.doesNotThrow(() => savePendingOrder({ code: 'X', total: 1 }));
});
