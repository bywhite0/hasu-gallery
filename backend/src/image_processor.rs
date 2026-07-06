use image::{codecs::jpeg::JpegEncoder, imageops::FilterType, GenericImageView, ImageFormat};
use std::io::Cursor;

const JPEG_THUMBNAIL_QUALITY: u8 = 82;

/// 生成缩略图
///
/// 目标尺寸：400x400（保持比例）
pub fn generate_thumbnail(image_data: &[u8], max_size: u32) -> Result<Vec<u8>, String> {
    // 加载图片
    let img = image::load_from_memory(image_data)
        .map_err(|e| format!("Failed to load image: {}", e))?;

    // 计算缩略图尺寸（保持比例）
    let (width, height) = img.dimensions();
    let thumbnail = if width > max_size || height > max_size {
        img.resize(max_size, max_size, FilterType::Lanczos3)
    } else {
        img
    };

    // 编码为固定质量的 JPEG，避免依赖 image crate 的默认质量。
    let mut buffer = Vec::new();
    let thumbnail_rgb = thumbnail.to_rgb8();
    let mut encoder = JpegEncoder::new_with_quality(&mut buffer, JPEG_THUMBNAIL_QUALITY);
    encoder
        .encode_image(&thumbnail_rgb)
        .map_err(|e| format!("Failed to encode thumbnail: {}", e))?;

    Ok(buffer)
}

/// 检测图片格式并返回 MIME type
pub fn detect_image_format(data: &[u8]) -> Result<String, String> {
    let format = image::guess_format(data)
        .map_err(|e| format!("Failed to detect image format: {}", e))?;

    let mime = match format {
        ImageFormat::Png => "image/png",
        ImageFormat::Jpeg => "image/jpeg",
        ImageFormat::Gif => "image/gif",
        ImageFormat::WebP => "image/webp",
        _ => return Err("Unsupported image format".to_string()),
    };

    Ok(mime.to_string())
}

/// 获取图片尺寸
pub fn get_image_dimensions(data: &[u8]) -> Result<(u32, u32), String> {
    let img = image::load_from_memory(data)
        .map_err(|e| format!("Failed to load image: {}", e))?;

    Ok(img.dimensions())
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::DynamicImage;

    #[test]
    fn test_generate_thumbnail() {
        // 创建一个简单的测试图片（1x1 白色像素）
        let img = DynamicImage::new_rgb8(1, 1);
        let mut buffer = Vec::new();
        img.write_to(&mut Cursor::new(&mut buffer), ImageFormat::Png)
            .unwrap();

        // 生成缩略图
        let thumbnail = generate_thumbnail(&buffer, 400).unwrap();

        // 验证缩略图可以加载
        assert!(image::load_from_memory(&thumbnail).is_ok());
        assert_eq!(&thumbnail[..2], &[0xFF, 0xD8]);
        assert_eq!(image::guess_format(&thumbnail).unwrap(), ImageFormat::Jpeg);
    }

    #[test]
    fn test_generate_thumbnail_from_alpha_image() {
        let img = DynamicImage::new_rgba8(2, 2);
        let mut buffer = Vec::new();
        img.write_to(&mut Cursor::new(&mut buffer), ImageFormat::Png)
            .unwrap();

        let thumbnail = generate_thumbnail(&buffer, 400).unwrap();
        let decoded = image::load_from_memory(&thumbnail).unwrap();

        assert_eq!(decoded.color().channel_count(), 3);
    }

    #[test]
    fn test_detect_image_format() {
        // PNG 魔数
        let png_data = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        assert_eq!(detect_image_format(&png_data).unwrap(), "image/png");

        // JPEG 魔数
        let jpeg_data = vec![0xFF, 0xD8, 0xFF];
        assert_eq!(detect_image_format(&jpeg_data).unwrap(), "image/jpeg");
    }
}
