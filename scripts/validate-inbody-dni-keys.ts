/**
 * Valida claves DNI con/sin letra (parity TS).
 * Ejecutar: npx --yes tsx scripts/validate-inbody-dni-keys.ts
 */
import {
  completeSpanishDni,
  dniMatchKeys,
  dniNumericKey,
  findCustomerIdByDniKeys,
  normInbodyUserId,
} from '../src/lib/inbodyMeasurements';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const martaTaxLower = '32714482h';
const martaUserUpper = '32714482H';
const martaDigits = '32714482';

assert(normInbodyUserId(martaTaxLower) === '32714482H', 'norm lower→upper');
assert(completeSpanishDni(martaDigits) === '32714482H', 'completa letra H');
assert(dniNumericKey(martaTaxLower) === '32714482', 'numeric from lower');
assert(dniNumericKey(martaUserUpper) === '32714482', 'numeric from upper');

const keysTax = new Set(dniMatchKeys(martaTaxLower));
const keysUser = new Set(dniMatchKeys(martaUserUpper));
assert(keysTax.has('32714482H') || keysTax.has('32714482h'), 'tax keys include letter form');
assert(keysTax.has('32714482'), 'tax keys include digits');
assert(keysUser.has('32714482H'), 'user keys include letter');
assert(keysUser.has('32714482'), 'user keys include digits');

const map = new Map<string, string>();
for (const k of dniMatchKeys(martaTaxLower)) map.set(k, 'cust-marta');
assert(findCustomerIdByDniKeys(martaUserUpper, map) === 'cust-marta', 'link upper↔lower');
assert(findCustomerIdByDniKeys(martaDigits, map) === 'cust-marta', 'link digits↔letter');

console.log('OK validate-inbody-dni-keys');
