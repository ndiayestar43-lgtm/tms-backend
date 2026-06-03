import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';
import { logger } from '../utils/logger';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const uploadToCloudinary = async (
  filePath: string,
  folder: string,
  publicId?: string
): Promise<{ url: string; publicId: string }> => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `tms-connect/${folder}`,
      public_id: publicId,
      overwrite: true,
      resource_type: 'auto',
    });
    return { url: result.secure_url, publicId: result.public_id };
  } catch (error) {
    logger.error('Erreur upload Cloudinary :', error);
    throw new Error('Échec du téléversement du fichier');
  }
};

export const uploadBufferToCloudinary = async (
  buffer: Buffer,
  folder: string,
  publicId?: string,
  resourceType: 'image' | 'raw' | 'auto' = 'auto'
): Promise<{ url: string; publicId: string }> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `tms-connect/${folder}`,
        public_id: publicId,
        overwrite: true,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error || !result) {
          logger.error('Erreur upload buffer Cloudinary :', error);
          reject(new Error('Échec du téléversement'));
        } else {
          resolve({ url: result.secure_url, publicId: result.public_id });
        }
      }
    );
    uploadStream.end(buffer);
  });
};

export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    logger.error('Erreur suppression Cloudinary :', error);
  }
};

export { cloudinary };
