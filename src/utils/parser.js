/**
 * NOTAM Parser Utility (from vvkpops)
 * 
 * This module contains functions to parse raw ICAO-formatted NOTAM text
 * into a structured JavaScript object. It can handle standard fields (Q, A, B, C, E)
 * and identify cancellation NOTAMs (NOTAMC).
 */

/**
 * Parses a raw NOTAM string into a structured object.
 * @param {string} rawText The full raw NOTAM text.
 * @returns {object|null} A structured NOTAM object or null if parsing fails.
 */
export function parseRawNotam(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return null;
  }

  const cleanText = rawText
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  const lines = cleanText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const result = {
    isCancellation: false,
    cancelsNotam: null,
    qLine: '',
    aerodrome: '',
    validFromRaw: '',
    validToRaw: '',
    schedule: '',
    body: '',
    notamNumber: ''
  };

  const firstLine = lines[0] || '';
  
  const notamNumberMatch = firstLine.match(/([A-Z]\d{4}\/\d{2})/);
  if (notamNumberMatch) {
    result.notamNumber = notamNumberMatch[1];
  }

  const notamcMatch = firstLine.match(/NOTAMC\s+([A-Z0-9]+\/[0-9]{2})/);
  if (notamcMatch) {
    result.isCancellation = true;
    result.cancelsNotam = notamcMatch[1];
  }

  const fieldRegex = /^([A-G])\)\s*(.*)/;
  let currentField = null;
  let eLineStarted = false;
  let hasELine = lines.some(line => line.startsWith('E)'));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (i === 0 && (notamNumberMatch || notamcMatch)) {
      continue;
    }

    if (eLineStarted && !fieldRegex.test(line)) {
      result.body += `\n${line}`;
      continue;
    }

    const match = line.match(fieldRegex);
    if (!match) {
      if (currentField && !eLineStarted) {
        switch (currentField) {
          case 'Q': result.qLine += ` ${line}`; break;
          case 'A': result.aerodrome += ` ${line}`; break;
          case 'B': result.validFromRaw += ` ${line}`; break;
          case 'C': result.validToRaw += ` ${line}`; break;
          case 'D': result.schedule += ` ${line}`; break;
        }
      } else if (eLineStarted) {
        result.body += `\n${line}`;
      } else if (!hasELine && currentField === 'C') {
        result.body += `${line}\n`;
        eLineStarted = true;
      }
      continue;
    }

    const [, field, value] = match;
    currentField = field;
    
    switch (field) {
      case 'Q': result.qLine = value.trim(); eLineStarted = false; break;
      case 'A': result.aerodrome = value.trim(); eLineStarted = false; break;
      case 'B': result.validFromRaw = value.trim(); eLineStarted = false; break;
      case 'C': result.validToRaw = value.trim(); if (result.validToRaw.toUpperCase().includes('PERM')) { result.validToRaw = 'PERM'; } eLineStarted = false; break;
      case 'D': result.schedule = value.trim(); eLineStarted = false; break;
      case 'E': result.body = value.trim(); eLineStarted = true; break;
      case 'F':
      case 'G':
        if (result.body) { result.body += `\n${field}) ${value.trim()}`; } else { result.body = `${field}) ${value.trim()}`; }
        eLineStarted = true;
        break;
    }
  }

  result.qLine = result.qLine.trim();
  result.aerodrome = result.aerodrome.trim();
  result.validFromRaw = result.validFromRaw.trim();
  result.validToRaw = result.validToRaw.trim();
  result.schedule = result.schedule.trim();
  result.body = result.body.trim();
  
  return result;
}