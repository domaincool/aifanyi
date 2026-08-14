/**
 * StorageService 抽象层（Phase 0）
 * 业务层只依赖 StorageService 接口，不直接依赖 Prisma Json / 本地文件 / 具体对象存储。
 * - Development: LocalStorageService（本地磁盘）
 * - Production:  S3CompatibleStorageService（R2 / S3 / OSS，S3 API 兼容，供应商由工程环境决定）
 */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface StorageUploadMeta {
  contentType: string;
  originalName?: string;
}

export interface StoredFile {
  storageKey: string;
  contentType: string;
  originalName?: string;
  size: number;
}

export interface StorageService {
  upload(file: Buffer, meta: StorageUploadMeta): Promise<StoredFile>;
  get(storageKey: string): Promise<{ data: Buffer; contentType: string }>;
  delete(storageKey: string): Promise<void>;
  getSignedUrl(storageKey: string, ttlSeconds?: number): Promise<string>;
}

const DEFAULT_TTL_SECONDS = 15 * 60; // 15 分钟

function extFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'application/pdf': '.pdf',
    'text/csv': '.csv',
    'application/json': '.json',
  };
  return map[contentType] ?? '';
}

function inferContentType(key: string): string {
  const ext = path.extname(key).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.csv': 'text/csv',
    '.json': 'application/json',
  };
  return map[ext] ?? 'application/octet-stream';
}

/** 本地磁盘实现（Development） */
export class LocalStorageService implements StorageService {
  private readonly rootDir: string;

  constructor(rootDir?: string) {
    this.rootDir = path.resolve(rootDir ?? path.join(process.cwd(), 'storage'));
  }

  private resolve(key: string): string {
    // 防路径穿越：解析后必须仍在 rootDir 内
    const p = path.resolve(this.rootDir, key);
    if (p !== this.rootDir && !p.startsWith(this.rootDir + path.sep)) {
      throw new Error('invalid storage key: ' + key);
    }
    return p;
  }

  async upload(file: Buffer, meta: StorageUploadMeta): Promise<StoredFile> {
    const id = randomUUID();
    const ext = extFromContentType(meta.contentType);
    const storageKey = id + ext;
    const full = this.resolve(storageKey);
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, file);
    return {
      storageKey,
      contentType: meta.contentType,
      originalName: meta.originalName,
      size: file.byteLength,
    };
  }

  async get(storageKey: string): Promise<{ data: Buffer; contentType: string }> {
    const data = await fs.promises.readFile(this.resolve(storageKey));
    return { data, contentType: inferContentType(storageKey) };
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await fs.promises.unlink(this.resolve(storageKey));
    } catch {
      // 文件不存在视为已删除（幂等）
    }
  }

  async getSignedUrl(storageKey: string, _ttlSeconds: number = DEFAULT_TTL_SECONDS): Promise<string> {
    // 本地无对象存储签名能力：返回需鉴权的代理 API 路径（后端校验权限后回源本地文件）
    return '/api/ecommerce/storage/' + encodeURIComponent(storageKey);
  }
}

/** S3 兼容对象存储配置（R2 / S3 / OSS） */
export interface S3StorageConfig {
  endpoint: string;
  region?: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
}

/** S3 兼容对象存储（Production，Phase 0 接口桩，生产切换时实现） */
export class S3CompatibleStorageService implements StorageService {
  constructor(private readonly config: S3StorageConfig) {}

  private notReady(): never {
    throw new Error('S3CompatibleStorageService 尚未实现（Production 切换阶段接入，Phase 0 仅占位）');
  }

  async upload(): Promise<StoredFile> { return this.notReady(); }
  async get(): Promise<{ data: Buffer; contentType: string }> { return this.notReady(); }
  async delete(): Promise<void> { return this.notReady(); }
  async getSignedUrl(): Promise<string> { return this.notReady(); }
}

let _service: StorageService | null = null;

/** 获取当前 StorageService（单例，按 STORAGE_PROVIDER 环境变量选择） */
export function getStorageService(): StorageService {
  if (_service) return _service;
  const provider = (process.env.STORAGE_PROVIDER ?? 'local').toLowerCase();
  if (provider === 's3' || provider === 's3-compatible' || provider === 'oss') {
    const cfg: S3StorageConfig = {
      endpoint: process.env.STORAGE_S3_ENDPOINT ?? '',
      region: process.env.STORAGE_S3_REGION,
      bucket: process.env.STORAGE_S3_BUCKET ?? '',
      accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY ?? '',
      publicBaseUrl: process.env.STORAGE_S3_PUBLIC_BASE_URL,
    };
    _service = new S3CompatibleStorageService(cfg);
  } else {
    _service = new LocalStorageService(process.env.STORAGE_ROOT);
  }
  return _service;
}
