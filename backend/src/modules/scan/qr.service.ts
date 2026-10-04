import QRCode from "qrcode";
import { Code128Generator, BarcodeOptions } from "./code128.util";

export interface AssetIdentityPayload {
  assetId: string;
  assetTag: string;
  barcode: string;
  qrCode: string;
  name: string;
  companyName?: string;
  companyCode?: string;
  categoryName?: string;
  categoryCode?: string;
  serialNumber?: string | null;
  modelNumber?: string | null;
}

export interface QrGenerationResult {
  token: string;
  canonicalPayload: string;
  svg: string;
  dataUrl: string;
}

export interface BarcodeGenerationResult {
  code: string;
  svg: string;
  dataUrl: string;
}

export interface PrintableLabelResult {
  assetId: string;
  assetTag: string;
  name: string;
  companyName: string;
  companyCode: string;
  categoryName: string;
  categoryCode: string;
  serialNumber: string | null;
  modelNumber: string | null;
  qrPayload: string;
  qrSvg: string;
  qrDataUrl: string;
  barcodeSvg: string;
  barcodeDataUrl: string;
  printedAt: string;
}

export class QrService {
  /**
   * Generates standard canonical QR payload string.
   * Format: asset:{uuid}
   * Zero sensitive information embedded in payload.
   */
  public static formatCanonicalPayload(assetId: string): string {
    return `asset:${assetId}`;
  }

  /**
   * Generates scannable QR Code SVG and DataURL.
   */
  public async generateQr(payload: string, options: { width?: number; margin?: number } = {}): Promise<QrGenerationResult> {
    const { width = 256, margin = 2 } = options;

    const svg = await QRCode.toString(payload, {
      type: "svg",
      width,
      margin,
      color: {
        dark: "#0f172a",
        light: "#ffffff"
      },
      errorCorrectionLevel: "M"
    });

    const dataUrl = await QRCode.toDataURL(payload, {
      width,
      margin,
      color: {
        dark: "#0f172a",
        light: "#ffffff"
      },
      errorCorrectionLevel: "M"
    });

    return {
      token: payload,
      canonicalPayload: payload,
      svg,
      dataUrl
    };
  }

  /**
   * Generates Code 128 barcode for asset identification.
   */
  public generateBarcode(code: string, options: BarcodeOptions = {}): BarcodeGenerationResult {
    const svg = Code128Generator.generateSvg(code, options);
    const dataUrl = Code128Generator.generateDataUrl(code, options);

    return {
      code,
      svg,
      dataUrl
    };
  }

  /**
   * Generates complete printable label dataset for an asset.
   */
  public async generatePrintableLabel(asset: AssetIdentityPayload): Promise<PrintableLabelResult> {
    const canonicalPayload = QrService.formatCanonicalPayload(asset.assetId);
    const qr = await this.generateQr(canonicalPayload, { width: 180, margin: 1 });
    const barcode = this.generateBarcode(asset.assetTag, { barHeight: 48, moduleWidth: 1.8, includeText: true });

    return {
      assetId: asset.assetId,
      assetTag: asset.assetTag,
      name: asset.name,
      companyName: asset.companyName || "PANTONE ENTERPRISE",
      companyCode: asset.companyCode || "PANTONE",
      categoryName: asset.categoryName || "Fixed Asset",
      categoryCode: asset.categoryCode || "AST",
      serialNumber: asset.serialNumber || null,
      modelNumber: asset.modelNumber || null,
      qrPayload: canonicalPayload,
      qrSvg: qr.svg,
      qrDataUrl: qr.dataUrl,
      barcodeSvg: barcode.svg,
      barcodeDataUrl: barcode.dataUrl,
      printedAt: new Date().toISOString()
    };
  }
}

export const qrService = new QrService();
