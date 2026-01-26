/**
 * 图片压缩工具
 * 将图片转为 base64 并压缩
 */

interface CompressOptions {
  maxWidth?: number;   // 最大宽度，默认 200
  maxHeight?: number;  // 最大高度，默认 200
  quality?: number;    // 压缩质量 0-1，默认 0.8
}

/**
 * 压缩图片并转为 base64
 * @param filePath 图片临时路径
 * @param options 压缩选项
 * @returns Promise<string> base64 字符串
 */
export function compressImageToBase64(
  filePath: string,
  options: CompressOptions = {}
): Promise<string> {
  const { maxWidth = 200, maxHeight = 200, quality = 0.8 } = options;

  return new Promise((resolve, reject) => {
    // 获取图片信息
    wx.getImageInfo({
      src: filePath,
      success: (imageInfo) => {
        const { width, height } = imageInfo;

        // 计算压缩后的尺寸
        let targetWidth = width;
        let targetHeight = height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          targetWidth = Math.floor(width * ratio);
          targetHeight = Math.floor(height * ratio);
        }

        // 创建离屏 canvas
        const canvas = wx.createOffscreenCanvas({
          type: '2d',
          width: targetWidth,
          height: targetHeight,
        });
        const ctx = canvas.getContext('2d');

        // 加载图片
        const image = canvas.createImage();
        image.onload = () => {
          // 绘制压缩后的图片
          ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

          // 导出为 base64
          try {
            const base64 = canvas.toDataURL('image/jpeg', quality);
            resolve(base64);
          } catch (error) {
            reject(new Error('图片压缩失败'));
          }
        };

        image.onerror = () => {
          reject(new Error('图片加载失败'));
        };

        image.src = filePath;
      },
      fail: (error) => {
        reject(new Error(error.errMsg || '获取图片信息失败'));
      },
    });
  });
}

/**
 * 压缩图片（使用微信原生压缩 API）
 * @param filePath 图片临时路径
 * @param quality 压缩质量 0-100，默认 80
 * @returns Promise<string> 压缩后的临时路径
 */
export function compressImage(
  filePath: string,
  quality: number = 80
): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src: filePath,
      quality,
      success: (res) => {
        resolve(res.tempFilePath);
      },
      fail: (error) => {
        // 如果压缩失败，返回原图路径
        console.warn('图片压缩失败，使用原图:', error);
        resolve(filePath);
      },
    });
  });
}

/**
 * 将图片文件转为 base64（不压缩）
 * @param filePath 图片路径
 * @returns Promise<string> base64 字符串
 */
export function imageToBase64(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (res) => {
        // 获取文件扩展名来确定 MIME 类型
        const ext = filePath.split('.').pop()?.toLowerCase() || 'jpeg';
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        resolve(`data:${mimeType};base64,${res.data}`);
      },
      fail: (error) => {
        reject(new Error(error.errMsg || '读取文件失败'));
      },
    });
  });
}

/**
 * 压缩图片后转为 base64（推荐使用）
 * 先用微信原生 API 压缩，再转 base64
 * @param filePath 图片临时路径
 * @param quality 压缩质量 0-100，默认 60
 * @returns Promise<string> base64 字符串
 */
export async function compressAndConvertToBase64(
  filePath: string,
  quality: number = 60
): Promise<string> {
  // 先压缩图片
  const compressedPath = await compressImage(filePath, quality);
  // 再转为 base64
  return imageToBase64(compressedPath);
}
