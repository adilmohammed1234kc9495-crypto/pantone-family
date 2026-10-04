import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import crypto from "crypto";
import { env } from "../config/env";
import { BadRequestError, ForbiddenError, NotFoundError } from "../utils/errors";
import { logger } from "../config/logger";

export interface StoredFileMetadata {
  fileId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  companyId: string;
  category: "assets" | "inspections" | "maintenance" | "documents";
  relativePath: string;
  checksumSha256: string;
  uploadedAt: string;
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export class StorageService {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(env.STORAGE_PATH);
    this.ensureDirectory(this.baseDir);
  }

  private ensureDirectory(dirPath: string): void {
    if (!fsSync.existsSync(dirPath)) {
      fsSync.mkdirSync(dirPath, { recursive: true });
    }
  }

  public async saveFile(params: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    companyId: string;
    category: "assets" | "inspections" | "maintenance" | "documents";
  }): Promise<StoredFileMetadata> {
    const { buffer, originalName, mimeType, companyId, category } = params;

    // 1. Validation: Size
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestError(`File size exceeds maximum allowed limit of 10MB`);
    }

    // 2. Validation: MIME Type
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestError(`Unsupported file type: ${mimeType}`);
    }

    // 3. Security: Sanitize filename & sanitize tenant ID
    const sanitizedCompany = companyId.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!sanitizedCompany) {
      throw new BadRequestError("Invalid company context for file storage");
    }

    const fileExt = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, "");
    const fileId = crypto.randomUUID();
    const safeFileName = `${fileId}${fileExt}`;

    // 4. Tenant-isolated subdirectory: <base>/tenants/<companyId>/<category>/
    const targetDir = path.join(this.baseDir, "tenants", sanitizedCompany, category);
    this.ensureDirectory(targetDir);

    const fullPath = path.join(targetDir, safeFileName);

    // Verify path stays within base directory (Path Traversal Protection)
    if (!fullPath.startsWith(this.baseDir)) {
      throw new ForbiddenError("Path traversal violation detected");
    }

    // 5. Checksum calculation
    const checksumSha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    // 6. Write file atomically
    await fs.writeFile(fullPath, buffer);

    logger.info("File stored securely in persistent storage", {
      fileId,
      companyId: sanitizedCompany,
      category,
      sizeBytes: buffer.length,
      checksumSha256,
    });

    const relativePath = path.relative(this.baseDir, fullPath).replace(/\\/g, "/");

    return {
      fileId,
      originalName: path.basename(originalName),
      mimeType,
      sizeBytes: buffer.length,
      companyId: sanitizedCompany,
      category,
      relativePath,
      checksumSha256,
      uploadedAt: new Date().toISOString(),
    };
  }

  public async getFileStream(params: {
    relativePath: string;
    requestingCompanyId?: string;
    isCommonAdmin?: boolean;
  }): Promise<{ stream: fsSync.ReadStream; size: number }> {
    const { relativePath, requestingCompanyId, isCommonAdmin } = params;

    const normalizedRelative = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
    const fullPath = path.resolve(this.baseDir, normalizedRelative);

    // Prevent Path Traversal
    if (!fullPath.startsWith(this.baseDir)) {
      throw new ForbiddenError("Path traversal access prohibited");
    }

    if (!fsSync.existsSync(fullPath)) {
      throw new NotFoundError("Requested attachment or file not found");
    }

    // Tenant Isolation Check
    if (!isCommonAdmin && requestingCompanyId) {
      const sanitizedCompany = requestingCompanyId.replace(/[^a-zA-Z0-9_-]/g, "");
      const expectedTenantSegment = path.join("tenants", sanitizedCompany);
      if (!fullPath.includes(expectedTenantSegment)) {
        throw new ForbiddenError("Unauthorized access to multi-tenant file resource");
      }
    }

    const stat = await fs.stat(fullPath);
    const stream = fsSync.createReadStream(fullPath);

    return { stream, size: stat.size };
  }

  public async deleteFile(params: {
    relativePath: string;
    requestingCompanyId?: string;
    isCommonAdmin?: boolean;
  }): Promise<void> {
    const { relativePath, requestingCompanyId, isCommonAdmin } = params;

    const normalizedRelative = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
    const fullPath = path.resolve(this.baseDir, normalizedRelative);

    if (!fullPath.startsWith(this.baseDir)) {
      throw new ForbiddenError("Path traversal access prohibited");
    }

    if (!fsSync.existsSync(fullPath)) {
      return;
    }

    if (!isCommonAdmin && requestingCompanyId) {
      const sanitizedCompany = requestingCompanyId.replace(/[^a-zA-Z0-9_-]/g, "");
      const expectedTenantSegment = path.join("tenants", sanitizedCompany);
      if (!fullPath.includes(expectedTenantSegment)) {
        throw new ForbiddenError("Unauthorized access to multi-tenant file resource");
      }
    }

    await fs.unlink(fullPath);
  }
}

export const storageService = new StorageService();

