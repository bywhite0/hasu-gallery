use image::{
    codecs::jpeg::JpegEncoder, imageops::FilterType, DynamicImage, GenericImageView, ImageFormat,
    ImageReader, Limits,
};
use std::io::Cursor;

const JPEG_THUMBNAIL_QUALITY: u8 = 82;
const JPEG_PUBLIC_QUALITY: u8 = 92;

/// Result of the single bounded decode of an upload: the sanitized bytes for
/// the public original plus the thumbnail derived from the same decode.
#[derive(Debug)]
pub struct ProcessedUploadImage {
    pub public_bytes: Vec<u8>,
    pub content_type: &'static str,
    pub thumbnail_jpeg: Vec<u8>,
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

/// Read the declared dimensions from the image header without decoding any
/// pixel data, so decompression-bomb checks can run before the first (and
/// only) full decode allocates memory.
pub fn read_image_dimensions(data: &[u8]) -> Result<(u32, u32), String> {
    ImageReader::new(Cursor::new(data))
        .with_guessed_format()
        .map_err(|e| format!("Failed to read image header: {}", e))?
        .into_dimensions()
        .map_err(|e| format!("Failed to read image dimensions: {}", e))
}

/// Decode an upload exactly once, with hard decoder limits, and derive both
/// public artifacts from that decode:
///
/// - JPEG/PNG are re-encoded so EXIF/XMP/GPS and similar metadata are
///   dropped. Animated GIF/WebP keep original container bytes so frame
///   animation is not lost; those formats rarely embed GPS-style EXIF the
///   way camera JPEGs do.
/// - The thumbnail is encoded from the same in-memory image, so the source
///   bytes are never decoded a second time.
pub fn process_upload_image(
    image_data: &[u8],
    content_type: &str,
    max_dimension: u32,
    thumbnail_size: u32,
) -> Result<ProcessedUploadImage, String> {
    let img = decode_bounded(image_data, max_dimension)?;

    let (public_bytes, public_content_type) = match content_type {
        "image/jpeg" => (encode_jpeg(&img, JPEG_PUBLIC_QUALITY)?, "image/jpeg"),
        "image/png" => {
            let mut buffer = Vec::new();
            img.write_to(&mut Cursor::new(&mut buffer), ImageFormat::Png)
                .map_err(|e| format!("Failed to encode public PNG: {}", e))?;
            (buffer, "image/png")
        }
        "image/gif" | "image/webp" => {
            (image_data.to_vec(), content_type_static(content_type)?)
        }
        _ => {
            return Err(format!(
                "Unsupported content type for public original: {}",
                content_type
            ))
        }
    };

    let thumbnail_jpeg = thumbnail_from_image(&img, thumbnail_size)?;

    Ok(ProcessedUploadImage {
        public_bytes,
        content_type: public_content_type,
        thumbnail_jpeg,
    })
}

fn decode_bounded(data: &[u8], max_dimension: u32) -> Result<DynamicImage, String> {
    let mut reader = ImageReader::new(Cursor::new(data))
        .with_guessed_format()
        .map_err(|e| format!("Failed to read image header: {}", e))?;
    let mut limits = Limits::default();
    limits.max_image_width = Some(max_dimension);
    limits.max_image_height = Some(max_dimension);
    reader.limits(limits);
    reader
        .decode()
        .map_err(|e| format!("Failed to load image: {}", e))
}

fn thumbnail_from_image(img: &DynamicImage, max_size: u32) -> Result<Vec<u8>, String> {
    let (width, height) = img.dimensions();
    // 编码为固定质量的 JPEG，避免依赖 image crate 的默认质量。
    let rgb = if width > max_size || height > max_size {
        img.resize(max_size, max_size, FilterType::Lanczos3).to_rgb8()
    } else {
        img.to_rgb8()
    };
    let mut buffer = Vec::new();
    let mut encoder = JpegEncoder::new_with_quality(&mut buffer, JPEG_THUMBNAIL_QUALITY);
    encoder
        .encode_image(&rgb)
        .map_err(|e| format!("Failed to encode thumbnail: {}", e))?;
    Ok(buffer)
}

fn content_type_static(content_type: &str) -> Result<&'static str, String> {
    match content_type {
        "image/gif" => Ok("image/gif"),
        "image/webp" => Ok("image/webp"),
        "image/jpeg" => Ok("image/jpeg"),
        "image/png" => Ok("image/png"),
        _ => Err(format!("Unsupported content type: {}", content_type)),
    }
}

fn encode_jpeg(img: &DynamicImage, quality: u8) -> Result<Vec<u8>, String> {
    let mut buffer = Vec::new();
    let rgb = img.to_rgb8();
    let mut encoder = JpegEncoder::new_with_quality(&mut buffer, quality);
    encoder
        .encode_image(&rgb)
        .map_err(|e| format!("Failed to encode public JPEG: {}", e))?;
    Ok(buffer)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::codecs::gif::GifEncoder;
    use image::{DynamicImage, Frame};

    fn png_bytes(img: &DynamicImage) -> Vec<u8> {
        let mut buffer = Vec::new();
        img.write_to(&mut Cursor::new(&mut buffer), ImageFormat::Png)
            .unwrap();
        buffer
    }

    #[test]
    fn process_upload_image_produces_jpeg_thumbnail() {
        let buffer = png_bytes(&DynamicImage::new_rgb8(1, 1));

        let processed = process_upload_image(&buffer, "image/png", 8192, 400).unwrap();

        assert!(image::load_from_memory(&processed.thumbnail_jpeg).is_ok());
        assert_eq!(&processed.thumbnail_jpeg[..2], &[0xFF, 0xD8]);
        assert_eq!(
            image::guess_format(&processed.thumbnail_jpeg).unwrap(),
            ImageFormat::Jpeg
        );
    }

    #[test]
    fn process_upload_image_flattens_alpha_in_thumbnail() {
        let buffer = png_bytes(&DynamicImage::new_rgba8(2, 2));

        let processed = process_upload_image(&buffer, "image/png", 8192, 400).unwrap();
        let decoded = image::load_from_memory(&processed.thumbnail_jpeg).unwrap();

        assert_eq!(decoded.color().channel_count(), 3);
    }

    #[test]
    fn read_image_dimensions_reads_header_without_full_decode() {
        let buffer = png_bytes(&DynamicImage::new_rgb8(5, 3));
        assert_eq!(read_image_dimensions(&buffer).unwrap(), (5, 3));
    }

    #[test]
    fn process_upload_image_rejects_dimensions_over_decoder_limit() {
        let buffer = png_bytes(&DynamicImage::new_rgb8(16, 16));

        let error = process_upload_image(&buffer, "image/png", 8, 400)
            .expect_err("over-limit decode should fail");
        assert!(error.contains("Failed to load image"));
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

    #[test]
    fn process_upload_image_reencodes_jpeg_without_exif_app1() {
        // Minimal JPEG with APP1 EXIF marker after SOI.
        let img = DynamicImage::new_rgb8(2, 2);
        let jpeg = encode_jpeg(&img, 90).unwrap();
        assert_eq!(&jpeg[..2], &[0xFF, 0xD8]);

        // Insert a fake APP1 segment after SOI: FF E1 00 08 + "Exif\0\0"
        let mut with_exif = Vec::new();
        with_exif.extend_from_slice(&jpeg[..2]);
        with_exif.extend_from_slice(&[0xFF, 0xE1, 0x00, 0x08, b'E', b'x', b'i', b'f', 0, 0]);
        with_exif.extend_from_slice(&jpeg[2..]);
        assert!(with_exif.windows(4).any(|w| w == b"Exif"));

        let processed = process_upload_image(&with_exif, "image/jpeg", 8192, 400).unwrap();
        assert_eq!(processed.content_type, "image/jpeg");
        assert_eq!(&processed.public_bytes[..2], &[0xFF, 0xD8]);
        assert!(!processed.public_bytes.windows(4).any(|w| w == b"Exif"));
        assert!(image::load_from_memory(&processed.public_bytes).is_ok());
    }

    #[test]
    fn process_upload_image_keeps_gif_bytes() {
        let mut gif = Vec::new();
        {
            let mut encoder = GifEncoder::new(&mut gif);
            encoder
                .encode_frame(Frame::new(DynamicImage::new_rgba8(2, 2).to_rgba8()))
                .unwrap();
        }

        let processed = process_upload_image(&gif, "image/gif", 8192, 400).unwrap();

        assert_eq!(processed.content_type, "image/gif");
        assert_eq!(processed.public_bytes, gif);
        assert!(image::load_from_memory(&processed.thumbnail_jpeg).is_ok());
    }
}
