use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};

/// 哈希密码
pub fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| format!("Failed to hash password: {}", e))
}

/// 验证密码
pub fn verify_password(password: &str, password_hash: &str) -> Result<bool, String> {
    let parsed_hash = PasswordHash::new(password_hash)
        .map_err(|e| format!("Failed to parse password hash: {}", e))?;

    let argon2 = Argon2::default();

    Ok(argon2
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_and_verify() {
        let password = "test_password_123";

        // 哈希密码
        let hash = hash_password(password).expect("Failed to hash password");
        assert!(hash.starts_with("$argon2"));

        // 验证正确密码
        assert!(verify_password(password, &hash).unwrap());

        // 验证错误密码
        assert!(!verify_password("wrong_password", &hash).unwrap());
    }

    #[test]
    fn test_different_salts() {
        let password = "same_password";

        let hash1 = hash_password(password).unwrap();
        let hash2 = hash_password(password).unwrap();

        // 相同密码应该产生不同的哈希（因为盐不同）
        assert_ne!(hash1, hash2);

        // 但两个哈希都应该能验证原密码
        assert!(verify_password(password, &hash1).unwrap());
        assert!(verify_password(password, &hash2).unwrap());
    }
}
