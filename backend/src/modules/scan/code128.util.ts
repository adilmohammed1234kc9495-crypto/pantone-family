/**
 * Code 128 (Subset B) Pure-TypeScript Vector Barcode Generator
 * Conforms to ISO/IEC 15417 specification.
 * 
 * Generates lightweight, scalable, razor-sharp vector SVG barcode strings
 * with zero native binary or canvas dependencies.
 */

// 107 Code 128 symbol patterns (each string represents bar/space widths, 6 elements totaling 11 modules, STOP is 7 elements totaling 13 modules)
const CODE128_PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (104=StartB, 106=STOP)
];

const START_B_INDEX = 104;
const STOP_INDEX = 106;

export interface BarcodeOptions {
  includeText?: boolean;
  barHeight?: number;
  moduleWidth?: number;
  quietZone?: number;
  fontSize?: number;
}

export class Code128Generator {
  /**
   * Encodes a string into Code 128 (Subset B) modules.
   * Standard Subset B covers printable ASCII characters (char codes 32 to 126).
   */
  public static encode(text: string): { modules: number[]; checksum: number } {
    if (!text || text.length === 0) {
      throw new Error("Text to encode cannot be empty");
    }

    const charIndices: number[] = [];
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code < 32 || code > 126) {
        throw new Error(`Character '${text[i]}' (ASCII ${code}) is outside Code 128B range (32-126)`);
      }
      charIndices.push(code - 32);
    }

    // Calculate Checksum: (Start_B + sum(i * value)) % 103
    let checksumSum = START_B_INDEX;
    for (let i = 0; i < charIndices.length; i++) {
      checksumSum += (i + 1) * charIndices[i];
    }
    const checksum = checksumSum % 103;

    // Full sequence of symbol indices
    const allSymbols = [START_B_INDEX, ...charIndices, checksum, STOP_INDEX];

    // Convert symbols to binary modules (1 = bar, 0 = space)
    const modules: number[] = [];
    for (const symIndex of allSymbols) {
      const pattern = CODE128_PATTERNS[symIndex];
      let isBar = true;
      for (let p = 0; p < pattern.length; p++) {
        const width = parseInt(pattern[p], 10);
        for (let w = 0; w < width; w++) {
          modules.push(isBar ? 1 : 0);
        }
        isBar = !isBar;
      }
    }

    return { modules, checksum };
  }

  /**
   * Generates a clean vector SVG representation of Code 128 barcode.
   */
  public static generateSvg(text: string, options: BarcodeOptions = {}): string {
    const {
      includeText = true,
      barHeight = 60,
      moduleWidth = 2,
      quietZone = 20,
      fontSize = 12
    } = options;

    const { modules } = this.encode(text);
    const barcodeWidth = modules.length * moduleWidth;
    const totalWidth = barcodeWidth + quietZone * 2;
    const totalHeight = barHeight + (includeText ? fontSize + 12 : 0) + 16;

    let rectsSvg = "";
    let currentX = quietZone;

    for (let i = 0; i < modules.length; i++) {
      if (modules[i] === 1) {
        // Look ahead to combine contiguous bar modules for optimized SVG size
        let barModuleCount = 1;
        while (i + 1 < modules.length && modules[i + 1] === 1) {
          barModuleCount++;
          i++;
        }
        const width = barModuleCount * moduleWidth;
        rectsSvg += `<rect x="${currentX}" y="8" width="${width}" height="${barHeight}" fill="#0f172a" />`;
        currentX += width;
      } else {
        currentX += moduleWidth;
      }
    }

    const textSvg = includeText
      ? `<text x="${totalWidth / 2}" y="${barHeight + fontSize + 12}" font-family="monospace, Courier, sans-serif" font-size="${fontSize}" font-weight="600" text-anchor="middle" fill="#334155" letter-spacing="1">${text}</text>`
      : "";

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
  <rect width="100%" height="100%" fill="#ffffff" />
  ${rectsSvg}
  ${textSvg}
</svg>`;
  }

  /**
   * Generates a Data URL for direct <img src="..." /> usage.
   */
  public static generateDataUrl(text: string, options: BarcodeOptions = {}): string {
    const svg = this.generateSvg(text, options);
    const base64 = Buffer.from(svg).toString("base64");
    return `data:image/svg+xml;base64,${base64}`;
  }
}
