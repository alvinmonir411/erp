import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private isConfigured = false;

  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.isConfigured = true;
      this.logger.log(`Cloudinary successfully configured for cloud: ${cloudName}`);
    } else {
      this.logger.warn(
        'Cloudinary credentials not provided in .env. Falling back to local storage for invoice uploads.',
      );
    }
  }

  /**
   * Upload an image file buffer to Cloudinary or fallback to local disk
   */
  async uploadInvoiceFile(
    file: Express.Multer.File,
    subfolder = 'invoices',
  ): Promise<{ url: string; publicId: string }> {
    if (!file || !file.buffer) {
      throw new Error('No valid file buffer provided for upload');
    }

    // 1. If Cloudinary is configured, upload to Cloudinary
    if (this.isConfigured) {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `erp/${subfolder}`,
            resource_type: 'auto',
          },
          (error, result: UploadApiResponse | undefined) => {
            if (error || !result) {
              this.logger.error('Cloudinary upload failed:', error);
              return reject(error || new Error('Upload to Cloudinary failed'));
            }
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
            });
          },
        );
        uploadStream.end(file.buffer);
      });
    }

    // 2. Fallback: Save locally if Cloudinary is not yet configured
    const uploadDir = path.join(process.cwd(), 'uploads', subfolder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filePath = path.join(uploadDir, filename);

    fs.writeFileSync(filePath, file.buffer);
    const localUrl = `/uploads/${subfolder}/${filename}`;

    this.logger.log(`File saved locally at: ${filePath}`);
    return {
      url: localUrl,
      publicId: `local_${filename}`,
    };
  }

  /**
   * Delete an image from Cloudinary or local disk
   */
  async deleteInvoiceFile(publicId: string): Promise<boolean> {
    if (!publicId) return false;

    if (this.isConfigured && !publicId.startsWith('local_')) {
      try {
        const res = await cloudinary.uploader.destroy(publicId);
        return res.result === 'ok';
      } catch (err: any) {
        this.logger.error(`Failed to delete Cloudinary file ${publicId}:`, err?.message);
        return false;
      }
    }

    if (publicId.startsWith('local_')) {
      try {
        const filename = publicId.replace('local_', '');
        const filePath = path.join(process.cwd(), 'uploads', 'invoices', filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          return true;
        }
      } catch (err: any) {
        this.logger.error(`Failed to delete local file ${publicId}:`, err?.message);
      }
    }

    return false;
  }
}
