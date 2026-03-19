/**
 * Document type classifier.
 *
 * Victron's feed uses document_type values like "Datasheet", "Product Manual",
 * "Brochure", "System schematic", "Enclosure dimension", etc.
 *
 * This module normalizes those into a smaller set of canonical types and also
 * inspects URL / filename patterns as a fallback when document_type is missing.
 */

// Canonical types used internally
const TYPES = {
  DATASHEET: 'datasheet',
  MANUAL: 'manual',
  BROCHURE: 'brochure',
  SCHEMATIC: 'schematic',
  ENCLOSURE: 'enclosure',
  CERTIFICATE: 'certificate',
  THREE_D: '3d',
  PHOTO: 'photo',
  VIDEO: 'video',
  TECHNICAL: 'technical',
  OTHER: 'other',
};

// Map Victron document_type strings to canonical types
const TYPE_MAP = {
  'datasheet': TYPES.DATASHEET,
  'material safety datasheet': TYPES.DATASHEET,
  'product manual': TYPES.MANUAL,
  'old user manual': TYPES.MANUAL,
  'quick installation guide': TYPES.MANUAL,
  'brochure': TYPES.BROCHURE,
  'system schematic': TYPES.SCHEMATIC,
  'enclosure dimension': TYPES.ENCLOSURE,
  'certificate': TYPES.CERTIFICATE,
  'high quality photo': TYPES.PHOTO,
  'infographic image': TYPES.PHOTO,
  'technical information': TYPES.TECHNICAL,
  'publication': TYPES.TECHNICAL,
  'press release': TYPES.OTHER,
  'promo video': TYPES.VIDEO,
  'video': TYPES.VIDEO,
  'other': TYPES.OTHER,
};

// URL / filename pattern fallbacks
const URL_PATTERNS = [
  { pattern: /3d|step|stp|iges|igs|stl/i, type: TYPES.THREE_D },
  { pattern: /schematic|wiring[_-]?diagram/i, type: TYPES.SCHEMATIC },
  { pattern: /datasheet/i, type: TYPES.DATASHEET },
  { pattern: /manual|guide|installation/i, type: TYPES.MANUAL },
  { pattern: /brochure/i, type: TYPES.BROCHURE },
  { pattern: /dimension|enclosure|drawing|mechanical/i, type: TYPES.ENCLOSURE },
  { pattern: /certif/i, type: TYPES.CERTIFICATE },
];

/**
 * Classify a document into a canonical type.
 * @param {string} [docType]  - The document_type from the Victron feed
 * @param {string} [url]      - The document URL
 * @param {string} [name]     - The document name/title
 * @returns {string} One of the TYPES values
 */
function classifyDocument(docType, url, name) {
  // 1. Try direct map from Victron's document_type
  if (docType) {
    const mapped = TYPE_MAP[docType.toLowerCase().trim()];
    if (mapped) return mapped;
  }

  // 2. Inspect URL and name for pattern matches
  const combined = `${url || ''} ${name || ''}`;
  for (const { pattern, type } of URL_PATTERNS) {
    if (pattern.test(combined)) return type;
  }

  return TYPES.OTHER;
}

/**
 * Extract file format from URL.
 * @param {string} url
 * @returns {string|null}
 */
function extractFileFormat(url) {
  if (!url) return null;
  const match = url.match(/\.([a-zA-Z0-9]{2,5})(?:[?#]|$)/);
  return match ? match[1].toLowerCase() : null;
}

module.exports = { classifyDocument, extractFileFormat, TYPES };
