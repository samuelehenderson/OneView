/* GhostMap .P2 decoder — extract PPCL programs from a Siemens PXC-Modular panel
   backup, in the browser or Node. Mirrors tools/extract_p2.py.

   Records are 0x16-prefixed, CRLF-terminated, ASCII-hex-encoded. The decoded
   payload is TLV (type 0x01, 2-byte big-endian length, value). One field is the
   program point name (…​.PPCL); another is a PPCL line prefixed by its number.

   extractP2(bytes) -> [{ name, source }]  (name e.g. "AHU7"; source = .pcl text)
   Accepts a Uint8Array, ArrayBuffer, Node Buffer, or array of byte values. */
(function (root) {
  const HEX = '0123456789ABCDEFabcdef';
  function toBytes(input) {
    if (input instanceof Uint8Array) return input;
    if (typeof ArrayBuffer !== 'undefined' && input instanceof ArrayBuffer) return new Uint8Array(input);
    if (Array.isArray(input)) return Uint8Array.from(input);
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) return new Uint8Array(input);
    throw new Error('extractP2: unsupported input type');
  }
  function splitCRLF(bytes) {
    const out = []; let start = 0;
    for (let i = 0; i + 1 < bytes.length; i++) {
      if (bytes[i] === 0x0d && bytes[i + 1] === 0x0a) { out.push(bytes.subarray(start, i)); start = i + 2; i++; }
    }
    if (start < bytes.length) out.push(bytes.subarray(start));
    return out;
  }
  function decodeRecord(rec) {
    let s = 0; while (s < rec.length && rec[s] === 0x16) s++;     // lstrip 0x16
    let hex = '';
    for (let i = s; i < rec.length; i++) { const c = String.fromCharCode(rec[i]); if (HEX.indexOf(c) >= 0) hex += c; }
    if (hex.length % 2) hex = hex.slice(0, -1);
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }
  function tlvFields(d) {
    const out = []; let i = 0;
    while (i + 3 <= d.length) {
      if (d[i] === 0x01) {
        const len = (d[i + 1] << 8) | d[i + 2];
        if (i + 3 + len <= d.length) { out.push(latin1(d, i + 3, i + 3 + len)); i += 3 + len; continue; }
      }
      i++;
    }
    return out;
  }
  function latin1(d, a, b) { let s = ''; for (let i = a; i < b; i++) s += String.fromCharCode(d[i]); return s; }

  function extractP2(input) {
    const bytes = toBytes(input);
    const progs = {}; // fullName -> { lineNo: text }
    for (const rec of splitCRLF(bytes)) {
      const d = decodeRecord(rec); if (!d.length) continue;
      const fields = tlvFields(d);
      const prog = fields.find((f) => /^GVL\.[A-Z0-9.]+\.PPCL$/.test(f));
      const line = fields.find((f) => /^V?\d{5}/.test(f));
      if (!prog || !line) continue;
      const m = /^V?(\d{5})\s?([\s\S]*)$/.exec(line); if (!m) continue;
      (progs[prog] || (progs[prog] = {}))[parseInt(m[1], 10)] = m[2].replace(/\s+$/, '');
    }
    return Object.keys(progs).map((full) => {
      const parts = full.split('.');
      const name = parts[parts.length - 2]; // …​.AHU7.PPCL -> AHU7
      const lines = progs[full];
      const src = Object.keys(lines).map(Number).sort((a, b) => a - b)
        .map((ln) => String(ln).padStart(5, '0') + '\t' + lines[ln]).join('\n');
      return { name, source: src, lineCount: Object.keys(lines).length };
    });
  }

  if (typeof window !== 'undefined') root.extractP2 = extractP2;
  if (typeof module !== 'undefined' && module.exports) module.exports = { extractP2 };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
