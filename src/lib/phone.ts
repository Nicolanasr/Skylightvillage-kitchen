/**
 * Lebanese & International Phone Normalizer
 * Guarantees that all variations (+96103724473, 03 724 473, 3724473, 9613724473, 070123456, etc.)
 * resolve to the exact same canonical string: "+9613724473" or "+96170123456".
 */
export function normalizePhone(rawPhone: string | null | undefined): string {
  if (!rawPhone || typeof rawPhone !== 'string') return '';

  // 1. Remove all non-digits
  let digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';

  // 2. Strip international prefixes for Lebanon (00961 or 961)
  if (digits.startsWith('00961')) {
    digits = digits.slice(5);
  } else if (digits.startsWith('961') && digits.length >= 9) {
    digits = digits.slice(3);
  }

  // 3. Handle local Lebanese leading zeros (e.g. "03724473" -> "3724473" or "070123456" -> "70123456")
  if (digits.startsWith('0') && digits.length >= 8) {
    digits = digits.slice(1);
  }

  // 4. Validate Lebanese mobile/landline lengths
  // Lebanese numbers without country code are 7 digits (03, 01, 04, 05, 07, 08, 09) or 8 digits (70, 71, 76, 78, 79, 81, 86, etc.)
  if (digits.length === 7 || digits.length === 8) {
    return `+961${digits}`;
  }

  // 5. If it's already a full international number (e.g., +1415..., +336...)
  return `+${digits}`;
}

/**
 * Returns alternative lookup formats for database queries so even legacy raw records match!
 * e.g. for "+9613724473", returns ["+9613724473", "03724473", "3724473", "9613724473"]
 */
export function getPhoneLookupVariations(rawPhone: string): string[] {
  const normalized = normalizePhone(rawPhone);
  if (!normalized) return [];

  const variations = new Set<string>();
  variations.add(normalized);

  if (normalized.startsWith('+961')) {
    const localDigits = normalized.slice(4); // e.g. "3724473" or "70123456"
    variations.add(localDigits);
    variations.add(`0${localDigits}`);
    variations.add(`961${localDigits}`);
    variations.add(`+9610${localDigits}`);
  }

  return Array.from(variations);
}
