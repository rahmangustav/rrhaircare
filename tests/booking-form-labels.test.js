import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Form booking (`#bookingForm` di public/index.html) adalah form konversi utama
// situs ini (isi kursi salon). Setiap `<label for="X">` di dalamnya HARUS
// menunjuk ke sebuah id yang benar-benar ada pada elemen form (input/select/
// textarea) — kalau tidak, klik pada label tidak memfokuskan field-nya, dan
// screen reader kehilangan accessible name yang benar untuk field itu.
//
// Bug nyata yang pernah ada: `<label for="layanan">` tidak cocok dengan
// `<select id="layanan-select">` (id select sempat diubah untuk menghindari
// bentrok dengan `<section id="layanan">` di bagian lain halaman, tapi
// atribut `for` pada labelnya lupa ikut diupdate). Tes ini memuat sumber asli
// index.html supaya menguji markup yang benar-benar dikirim ke browser.

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(path.join(root, 'public/index.html'), 'utf8');

function extractSection(source, sectionStartNeedle) {
  const start = source.indexOf(sectionStartNeedle);
  assert.ok(start !== -1, `"${sectionStartNeedle}" tidak ditemukan di index.html`);
  const end = source.indexOf('</section>', start);
  assert.ok(end !== -1, `</section> penutup tidak ditemukan setelah "${sectionStartNeedle}"`);
  return source.slice(start, end);
}

const bookingSection = extractSection(html, '<section id="booking">');

const labelFors = [...bookingSection.matchAll(/<label\s+for="([^"]+)"/g)].map(m => m[1]);
const formControlIds = [...bookingSection.matchAll(/<(?:input|select|textarea)\s+[^>]*id="([^"]+)"/g)].map(m => m[1]);

test('form booking: setiap <label for="X"> punya field id="X" yang cocok', () => {
  assert.ok(labelFors.length > 0, 'tidak ada <label for="..."> yang terdeteksi di form booking');
  for (const forId of labelFors) {
    assert.ok(
      formControlIds.includes(forId),
      `label for="${forId}" tidak cocok dengan id field manapun di form booking (id yang ada: ${formControlIds.join(', ')})`,
    );
  }
});

test('form booking: label "Layanan" terhubung ke select layanan (bukan section#layanan)', () => {
  const layananLabelLine = bookingSection.split('\n').find(l => l.includes('Layanan *'));
  assert.ok(layananLabelLine, 'label "Layanan *" tidak ditemukan di form booking');
  assert.match(layananLabelLine, /for="layanan-select"/);
  assert.doesNotMatch(layananLabelLine, /for="layanan"[^-]/);
});
