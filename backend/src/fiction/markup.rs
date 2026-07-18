//! Hasu Fiction Markup (HFM) — constrained text profile, never raw HTML.
//!
//! Supported markers (line-oriented, intentionally small for Slice C):
//! - paragraphs: blank-line separated blocks
//! - emphasis: `*text*` (non-nested)
//! - line break: trailing `\\`
//! - safe links: `[label](https://...)` or `[label](http://...)`
//! - media ref: `{{media:uuid}}` where uuid is lowercase UUIDv4
//!
//! Forbidden: HTML tags, javascript:/data:/file: URLs, nested angle brackets.

use sha2::{Digest, Sha256};
use uuid::Uuid;

/// Decompressed revision body hard limit (Architecture V2 §7.4 / §8.4).
pub const MAX_MARKUP_BYTES: usize = 2 * 1024 * 1024;
/// Unicode scalar-value limit for one revision body.
pub const MAX_UNICODE_SCALARS: usize = 200_000;
pub const MAX_TITLE_CHARS: usize = 200;
pub const MAX_SYNOPSIS_CHARS: usize = 2_000;
pub const MAX_FANDOM_CHARS: usize = 120;
pub const MAX_EXCERPT_CHARS: usize = 280;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatedMarkup {
    pub markup_source: String,
    pub plain_text: String,
    pub word_count: i32,
    pub content_sha256: String,
    pub media_ids: Vec<Uuid>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MarkupError {
    pub code: &'static str,
    pub message: String,
}

pub fn validate_title(title: &str) -> Result<String, MarkupError> {
    let title = title.trim();
    if title.is_empty() {
        return Err(MarkupError {
            code: "invalid_title",
            message: "Title is required".into(),
        });
    }
    if title.chars().count() > MAX_TITLE_CHARS {
        return Err(MarkupError {
            code: "title_too_long",
            message: format!("Title exceeds {} characters", MAX_TITLE_CHARS),
        });
    }
    if contains_html_angle_brackets(title) {
        return Err(MarkupError {
            code: "unsafe_title",
            message: "Title must not contain HTML markup".into(),
        });
    }
    Ok(title.to_string())
}

pub fn validate_synopsis(synopsis: &str) -> Result<String, MarkupError> {
    let synopsis = synopsis.trim();
    if synopsis.chars().count() > MAX_SYNOPSIS_CHARS {
        return Err(MarkupError {
            code: "synopsis_too_long",
            message: format!("Synopsis exceeds {} characters", MAX_SYNOPSIS_CHARS),
        });
    }
    if contains_html_angle_brackets(synopsis) {
        return Err(MarkupError {
            code: "unsafe_synopsis",
            message: "Synopsis must not contain HTML markup".into(),
        });
    }
    Ok(synopsis.to_string())
}

pub fn validate_fandom(fandom: &str) -> Result<String, MarkupError> {
    let fandom = fandom.trim();
    if fandom.chars().count() > MAX_FANDOM_CHARS {
        return Err(MarkupError {
            code: "fandom_too_long",
            message: format!("Fandom exceeds {} characters", MAX_FANDOM_CHARS),
        });
    }
    if contains_html_angle_brackets(fandom) {
        return Err(MarkupError {
            code: "unsafe_fandom",
            message: "Fandom must not contain HTML markup".into(),
        });
    }
    Ok(fandom.to_string())
}

pub fn validate_markup(source: &str) -> Result<ValidatedMarkup, MarkupError> {
    if source.len() > MAX_MARKUP_BYTES {
        return Err(MarkupError {
            code: "body_too_large",
            message: format!("Fiction body exceeds {} bytes", MAX_MARKUP_BYTES),
        });
    }

    let scalar_count = source.chars().count();
    if scalar_count > MAX_UNICODE_SCALARS {
        return Err(MarkupError {
            code: "body_too_long",
            message: format!(
                "Fiction body exceeds {} Unicode scalar values",
                MAX_UNICODE_SCALARS
            ),
        });
    }

    if contains_html_angle_brackets(source) {
        return Err(MarkupError {
            code: "raw_html_forbidden",
            message: "Raw HTML is not allowed in Fiction markup".into(),
        });
    }

    // Reject obvious HTML entities used as tags.
    let lower = source.to_ascii_lowercase();
    for needle in ["<script", "</script", "<iframe", "<img", "<svg", "javascript:"] {
        if lower.contains(needle) {
            return Err(MarkupError {
                code: "raw_html_forbidden",
                message: "Unsafe markup constructs are not allowed".into(),
            });
        }
    }

    let mut media_ids = Vec::new();
    let mut plain = String::with_capacity(source.len());
    let mut i = 0;
    let bytes = source.as_bytes();
    while i < bytes.len() {
        // media ref {{media:uuid}}
        if bytes[i] == b'{' && source[i..].starts_with("{{media:") {
            if let Some(end) = source[i..].find("}}") {
                let inner = &source[i + 8..i + end];
                let id = parse_media_uuid(inner)?;
                media_ids.push(id);
                plain.push(' ');
                i += end + 2;
                continue;
            }
            return Err(MarkupError {
                code: "invalid_media_ref",
                message: "Unclosed media reference".into(),
            });
        }

        // markdown-like link [label](url)
        if bytes[i] == b'[' {
            if let Some((label, url, consumed)) = parse_link(&source[i..]) {
                validate_http_url(&url)?;
                plain.push_str(&label);
                plain.push(' ');
                i += consumed;
                continue;
            }
        }

        // emphasis *text* — strip markers for plain projection
        if bytes[i] == b'*' {
            if let Some(end) = source[i + 1..].find('*') {
                let content = &source[i + 1..i + 1 + end];
                if !content.is_empty() && !content.contains('\n') {
                    plain.push_str(content);
                    i += end + 2;
                    continue;
                }
            }
        }

        plain.push(source[i..].chars().next().unwrap());
        i += source[i..].chars().next().unwrap().len_utf8();
    }

    let plain_text = collapse_whitespace(&plain);
    if plain_text.is_empty() {
        return Err(MarkupError {
            code: "empty_body",
            message: "Fiction body must contain readable text".into(),
        });
    }

    let word_count = count_words(&plain_text);
    let mut hasher = Sha256::new();
    hasher.update(source.as_bytes());
    let content_sha256 = hex::encode(hasher.finalize());

    media_ids.sort_unstable();
    media_ids.dedup();

    Ok(ValidatedMarkup {
        markup_source: source.to_string(),
        plain_text,
        word_count,
        content_sha256,
        media_ids,
    })
}

pub fn excerpt_from_plain(plain: &str) -> String {
    let mut out = String::new();
    for (idx, ch) in plain.chars().enumerate() {
        if idx >= MAX_EXCERPT_CHARS {
            out.push('…');
            break;
        }
        out.push(ch);
    }
    out
}

fn contains_html_angle_brackets(value: &str) -> bool {
    value.contains('<') || value.contains('>')
}

fn parse_media_uuid(raw: &str) -> Result<Uuid, MarkupError> {
    let raw = raw.trim();
    if raw.chars().any(|c| c.is_ascii_uppercase()) {
        return Err(MarkupError {
            code: "invalid_media_ref",
            message: "Media UUID must be lowercase UUIDv4".into(),
        });
    }
    let id = Uuid::parse_str(raw).map_err(|_| MarkupError {
        code: "invalid_media_ref",
        message: "Media reference must be a valid UUID".into(),
    })?;
    if id.get_version_num() != 4 {
        return Err(MarkupError {
            code: "invalid_media_ref",
            message: "Media reference must be UUIDv4".into(),
        });
    }
    Ok(id)
}

fn parse_link(input: &str) -> Option<(String, String, usize)> {
    // [label](url)
    if !input.starts_with('[') {
        return None;
    }
    let label_end = input.find(']')?;
    let rest = &input[label_end + 1..];
    if !rest.starts_with('(') {
        return None;
    }
    let url_end = rest.find(')')?;
    let label = input[1..label_end].to_string();
    let url = rest[1..url_end].to_string();
    if label.is_empty() || url.is_empty() {
        return None;
    }
    Some((label, url, label_end + 1 + url_end + 1))
}

fn validate_http_url(url: &str) -> Result<(), MarkupError> {
    let url = url.trim();
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("https://") || lower.starts_with("http://")) {
        return Err(MarkupError {
            code: "unsafe_link",
            message: "Only http(s) links are allowed".into(),
        });
    }
    for bad in ["javascript:", "data:", "file:", "vbscript:"] {
        if lower.contains(bad) {
            return Err(MarkupError {
                code: "unsafe_link",
                message: "Link scheme is not allowed".into(),
            });
        }
    }
    if url.contains('<') || url.contains('>') || url.contains('"') {
        return Err(MarkupError {
            code: "unsafe_link",
            message: "Link contains forbidden characters".into(),
        });
    }
    Ok(())
}

fn collapse_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn count_words(plain: &str) -> i32 {
    // Prefer whitespace-separated tokens; also count CJK runs as word-ish units.
    let mut count = 0i32;
    let mut in_latin = false;
    for ch in plain.chars() {
        if ch.is_whitespace() {
            in_latin = false;
            continue;
        }
        if is_cjk(ch) {
            count += 1;
            in_latin = false;
        } else if ch.is_alphanumeric() {
            if !in_latin {
                count += 1;
                in_latin = true;
            }
        } else {
            in_latin = false;
        }
    }
    count
}

fn is_cjk(ch: char) -> bool {
    matches!(
        ch,
        '\u{4E00}'..='\u{9FFF}'
            | '\u{3400}'..='\u{4DBF}'
            | '\u{3040}'..='\u{30FF}'
            | '\u{AC00}'..='\u{D7AF}'
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_simple_paragraph_and_emphasis() {
        let v = validate_markup("Hello *world*.\n\nSecond paragraph.").unwrap();
        assert!(v.plain_text.contains("Hello world"));
        assert!(v.word_count >= 3);
        assert_eq!(v.content_sha256.len(), 64);
    }

    #[test]
    fn rejects_raw_html() {
        let err = validate_markup("<script>alert(1)</script>").unwrap_err();
        assert_eq!(err.code, "raw_html_forbidden");
    }

    #[test]
    fn rejects_javascript_link() {
        let err = validate_markup("[x](javascript:alert(1))").unwrap_err();
        assert!(
            err.code == "unsafe_link" || err.code == "raw_html_forbidden",
            "got {}",
            err.code
        );
    }

    #[test]
    fn accepts_https_link_and_media_uuid() {
        let id = "550e8400-e29b-41d4-a716-446655440000";
        let body = format!("See [docs](https://example.com) and {{{{media:{id}}}}} end.");
        let v = validate_markup(&body).unwrap();
        assert_eq!(v.media_ids.len(), 1);
        assert!(v.plain_text.contains("docs"));
    }

    #[test]
    fn rejects_uppercase_media_uuid() {
        let body = "x {{media:550E8400-E29B-41D4-A716-446655440000}} y";
        let err = validate_markup(body).unwrap_err();
        assert_eq!(err.code, "invalid_media_ref");
    }

    #[test]
    fn excerpt_truncates() {
        let long = "字".repeat(400);
        let ex = excerpt_from_plain(&long);
        assert!(ex.chars().count() <= MAX_EXCERPT_CHARS + 1);
    }
}
