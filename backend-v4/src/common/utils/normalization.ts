/**
 * Normalization helpers for identity fields used in deduplication & matching.
 */

export function normalizeEmail(email?: string | null): string | null {
  if (!email || typeof email !== 'string') return null;
  const cleaned = email.trim().toLowerCase();
  if (!cleaned || !cleaned.includes('@')) return null;
  return cleaned;
}

export function normalizePhone(phone?: string | null): string | null {
  if (!phone || typeof phone !== 'string') return null;
  // Keep digits only; require at least 7 digits
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return digits;
}

export function normalizeLinkedIn(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  let cleaned = url.trim().toLowerCase();
  if (!cleaned) return null;

  cleaned = cleaned.replace(/^https?:\/\//, '');
  cleaned = cleaned.replace(/^www\./, '');
  cleaned = cleaned.replace(/\/+$/, '');
  cleaned = cleaned.split('?')[0].split('#')[0];

  // Prefer the path after linkedin.com/
  const idx = cleaned.indexOf('linkedin.com/');
  if (idx >= 0) {
    cleaned = cleaned.slice(idx + 'linkedin.com/'.length);
  }

  if (!cleaned || cleaned.length < 3) return null;
  return cleaned;
}

export function normalizeWebsite(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  let cleaned = url.trim().toLowerCase();
  if (!cleaned) return null;

  cleaned = cleaned.replace(/^https?:\/\//, '');
  cleaned = cleaned.replace(/^www\./, '');
  cleaned = cleaned.replace(/\/+$/, '');
  cleaned = cleaned.split('?')[0].split('#')[0];

  if (!cleaned || cleaned.length < 3) return null;
  return cleaned;
}

/**
 * Generic normalize for arbitrary dynamic fields used in dedupe/matching.
 * Trim + lowercase; empty becomes null.
 */
export function normalizeGeneric(value?: string | null): string | null {
  if (value == null || typeof value !== 'string') return null;
  const cleaned = value.trim().toLowerCase();
  return cleaned === '' ? null : cleaned;
}

export interface NormalizedLeadIdentity {
  emailNormalized: string | null;
  phoneNormalized: string | null;
  linkedinNormalized: string | null;
  websiteNormalized: string | null;
}

export interface IdentityExtractionOptions {
  /** When false, only fields explicitly included in `mapping` are normalized. */
  allowAutomaticDetection?: boolean;
}

/**
 * Extract identity values from a dynamic row (CSV headers may vary).
 * `mapping` optionally maps CSV header -> canonical name (email, phone, …).
 * If no mapping is provided we try common header names case-insensitively.
 */
export function extractIdentityFromRow(
  row: Record<string, string | null | undefined>,
  mapping?: Record<string, string>,
  options: IdentityExtractionOptions = {},
): NormalizedLeadIdentity {
  const allowAutomaticDetection = options.allowAutomaticDetection ?? true;
  const get = (canonical: string): string | null => {
    // 1. Explicit mapping
    if (mapping) {
      for (const [csvHeader, target] of Object.entries(mapping)) {
        if (target.toLowerCase() === canonical.toLowerCase()) {
          return getRowField(row, csvHeader);
        }
      }
    }

    if (!allowAutomaticDetection) return null;

    // 2. Direct key match (case-insensitive)
    const lowerCanonical = canonical.toLowerCase();
    for (const [key, val] of Object.entries(row)) {
      if (key.trim().toLowerCase() === lowerCanonical) {
        return val != null && String(val).trim() !== ''
          ? String(val).trim()
          : null;
      }
    }

    // 3. Common aliases
    const aliases: Record<string, string[]> = {
      email: ['e-mail', 'email address', 'email_address', 'mail'],
      phone: [
        'phone number',
        'phonenumber',
        'mobile',
        'tel',
        'telephone',
        'cell',
      ],
      linkedin: [
        'linkedin url',
        'linkedin_url',
        'linkedinurl',
        'li',
        'linkedin profile',
      ],
      website: [
        'web',
        'url',
        'site',
        'homepage',
        'company website',
        'web site',
      ],
    };
    const aliasList = aliases[lowerCanonical] || [];
    for (const [key, val] of Object.entries(row)) {
      const k = key.trim().toLowerCase();
      if (aliasList.includes(k)) {
        return val != null && String(val).trim() !== ''
          ? String(val).trim()
          : null;
      }
    }
    return null;
  };

  const email = get('email');
  const phone = get('phone');
  const linkedin = get('linkedin') || get('linkedinUrl') || get('linkedinurl');
  const website = get('website');

  return {
    emailNormalized: normalizeEmail(email),
    phoneNormalized: normalizePhone(phone),
    linkedinNormalized: normalizeLinkedIn(linkedin),
    websiteNormalized: normalizeWebsite(website),
  };
}

/**
 * Resolve a value from a row by exact header first, then case-insensitive.
 * Used so CSV field names stay identical to DB data keys.
 */
export function getRowField(
  row: Record<string, string | null | undefined>,
  fieldName: string,
): string | null {
  if (!fieldName) return null;
  if (Object.prototype.hasOwnProperty.call(row, fieldName)) {
    const v = row[fieldName];
    return v != null && String(v).trim() !== '' ? String(v).trim() : null;
  }
  const lower = fieldName.toLowerCase();
  for (const [k, v] of Object.entries(row)) {
    if (k.toLowerCase() === lower) {
      return v != null && String(v).trim() !== '' ? String(v).trim() : null;
    }
  }
  return null;
}

/**
 * Build a dedupe key based on the chosen strategy.
 *
 * - Built-in identity strategies (email, phone, linkedin, combinations)
 *   use normalized identity columns.
 * - Any other string is treated as a dynamic field name: the value is
 *   taken from the row under that exact CSV header (same as stored in DB)
 *   and normalized with trim+lowercase.
 *
 * Returns null when no usable identity/value is present.
 */
export function buildDedupeKey(
  identity: NormalizedLeadIdentity,
  strategy: string,
  row?: Record<string, string | null | undefined>,
): string | null {
  const {
    emailNormalized: e,
    phoneNormalized: p,
    linkedinNormalized: l,
  } = identity;

  const s = (strategy || '').toLowerCase().trim();

  switch (s) {
    case 'email':
      return e ? `e:${e}` : null;
    case 'phone':
      return p ? `p:${p}` : null;
    case 'linkedin':
      return l ? `l:${l}` : null;
    case 'email_or_phone':
      if (e) return `e:${e}`;
      if (p) return `p:${p}`;
      return null;
    case 'email_or_linkedin':
      if (e) return `e:${e}`;
      if (l) return `l:${l}`;
      return null;
    case 'phone_or_linkedin':
      if (p) return `p:${p}`;
      if (l) return `l:${l}`;
      return null;
    case 'email_or_phone_or_linkedin':
      if (e) return `e:${e}`;
      if (p) return `p:${p}`;
      if (l) return `l:${l}`;
      return null;
    default: {
      // Dynamic field: use the exact field name from CSV/DB
      if (!strategy || !row) {
        // Fallback to identity preference when no row provided
        if (e) return `e:${e}`;
        if (p) return `p:${p}`;
        if (l) return `l:${l}`;
        return null;
      }
      const raw = getRowField(row, strategy);
      const norm = normalizeGeneric(raw);
      return norm ? `f:${strategy.toLowerCase()}:${norm}` : null;
    }
  }
}

/** Whether the strategy is a built-in identity strategy */
export function isIdentityStrategy(strategy: string): boolean {
  const s = (strategy || '').toLowerCase().trim();
  return [
    'email',
    'phone',
    'linkedin',
    'email_or_phone',
    'email_or_linkedin',
    'phone_or_linkedin',
    'email_or_phone_or_linkedin',
  ].includes(s);
}

/** Clean a raw CSV cell – empty string becomes null */
export function cleanCell(value: unknown): string | null {
  if (value == null) return null;

  if (typeof value === 'string') {
    const s = value.trim();
    return s === '' ? null : s;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    const s = String(value).trim();
    return s === '' ? null : s;
  }

  return null;
}

/** Normalize all keys of a row (trim headers) and clean values */
export function normalizeRow(
  row: Record<string, unknown>,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.trim();
    if (!key) continue;
    out[key] = cleanCell(v);
  }
  return out;
}
