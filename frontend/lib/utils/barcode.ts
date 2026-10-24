/**
 * Zero-dependency Code-128 (Subset B) Barcode SVG Generator
 * Generates high-density, crystal-clear 1D barcodes that any 1D/2D laser or camera scanner can read.
 */

// Code 128B pattern encodings (107 patterns, each 11 modules wide)
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // Stop pattern is 13 modules
];

const START_CODE_B = 104;
const STOP_CODE = 106;

export function generateCode128Bars(text: string): string {
  // Convert text to char codes for Code 128B
  const codes: number[] = [START_CODE_B];
  let checksum = START_CODE_B;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    if (code >= 0 && code <= 95) {
      codes.push(code);
      checksum += code * (i + 1);
    }
  }

  const checkDigit = checksum % 103;
  codes.push(checkDigit);
  codes.push(STOP_CODE);

  // Convert codes into alternating bar and space widths
  let barString = '';
  for (const c of codes) {
    const pattern = CODE128_PATTERNS[c];
    if (pattern) {
      let isBar = true;
      for (const char of pattern) {
        const width = parseInt(char, 10);
        barString += isBar ? '1'.repeat(width) : '0'.repeat(width);
        isBar = !isBar;
      }
    }
  }

  return barString;
}
