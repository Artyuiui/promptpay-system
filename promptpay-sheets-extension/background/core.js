export const defaults = Object.freeze({host:'192.168.1.50',port:8080,token:'',mode:'row',column:'G',cell:'D10',timeout:60});
export function parseAmount(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') throw new Error('Amount is empty or not numeric.');
  const text = String(raw).trim().replace(/^฿\s*/, '');
  if (!/^(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text))
    throw new Error('Use a positive amount with up to two decimals (for example ฿1,259.00).');
  const [whole, fraction=''] = text.replaceAll(',', '').split('.');
  const cents = Number(whole)*100 + Number(fraction.padEnd(2,'0'));
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 999999999) throw new Error('Amount must be ฿0.01–฿9,999,999.99.');
  return cents / 100;
}
export function settings(input) {
  const s = {...defaults,...input};
  s.host = String(s.host).trim().toLowerCase();
  // Only exact loopback names are allowed for the same-machine web test.
  if (s.host !== 'localhost' && s.host !== '127.0.0.1') {
    const parts = s.host.split('.');
    if (parts.length!==4 || parts.some(p => !/^(0|[1-9]\d{0,2})$/.test(p) || Number(p)>255)) throw new Error('Enter a private LAN IPv4 address, localhost, or 127.0.0.1 (without http:// or port).');
    const [a,b] = parts.map(Number);
    if (!(a===10 || (a===172 && b>=16 && b<=31) || (a===192 && b===168) || (a===169 && b===254))) throw new Error('Use a private LAN address, localhost, or 127.0.0.1.');
  }
  s.port=Number(s.port); s.timeout=Number(s.timeout);
  if (!Number.isInteger(s.port) || s.port<1024 || s.port>65535) throw new Error('Port must be 1024–65535.');
  if (!Number.isInteger(s.timeout) || s.timeout<1 || s.timeout>3600) throw new Error('Timeout must be 1–3600 seconds.');
  if (!/^[A-Za-z0-9._~+-]{16,128}$/.test(s.token)) throw new Error('Enter the Android API token (16–128 letters, digits, or . _ ~ + -).');
  s.column=String(s.column).trim().toUpperCase(); s.cell=String(s.cell).trim().toUpperCase();
  if (!['row','fixed','selected'].includes(s.mode)) throw new Error('Select a valid amount source.');
  if (!/^[A-Z]{1,3}$/.test(s.column)) throw new Error('Column must be A–ZZZ.');
  if (!/^[A-Z]{1,3}[1-9]\d{0,6}$/.test(s.cell)) throw new Error('Fixed cell must be a single A1 address, such as D10.');
  return s;
}
export function selection(raw) {
  const value=String(raw).trim().toUpperCase().replaceAll('$','');
  let m=value.match(/^([A-Z]{1,3})([1-9]\d{0,6})(?::([A-Z]{1,3})([1-9]\d{0,6}))?$/);
  if (m) return {row:Number(m[2]),cell:m[1]+m[2],single:!m[3] || (m[1]===m[3] && m[2]===m[4]),oneRow:!m[4] || m[2]===m[4]};
  m=value.match(/^([1-9]\d{0,6}):\1$/);
  if (m) return {row:Number(m[1]),cell:null,single:false,oneRow:true};
  throw new Error('Select one cell or one row; named ranges and multi-row selections are ambiguous.');
}
export function targetCell(s, nameBox) {
  if (s.mode==='fixed') return s.cell;
  const selected=selection(nameBox);
  if (s.mode==='selected') { if (!selected.single) throw new Error('Selected Cell mode requires exactly one cell.'); return selected.cell; }
  if (!selected.oneRow) throw new Error('Current Row mode requires exactly one row.');
  return s.column+selected.row;
}
export function isSheet(url) { return /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9_-]+\//.test(url||''); }
