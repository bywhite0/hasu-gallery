// Architecture V3 S3: centralized deny-by-default authorization.
//
// Every protected read/write decision funnels through `decide`, a pure
// function over (principal, action) that the table-driven tests below cover
// exhaustively. Handlers load the principal once, then map the decision to
// their transport-specific error shape.

use tower_sessions::Session;

use crate::routes::auth::SESSION_USER_ID_KEY;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    Member,
    Moderator,
    Admin,
}

impl Role {
    pub fn parse(value: &str) -> Option<Role> {
        match value {
            "member" => Some(Role::Member),
            "moderator" => Some(Role::Moderator),
            "admin" => Some(Role::Admin),
            _ => None,
        }
    }

    pub fn is_staff(self) -> bool {
        matches!(self, Role::Moderator | Role::Admin)
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct Principal {
    pub user_id: Option<i64>,
    pub role: Option<Role>,
}

impl Principal {
    pub fn anonymous() -> Self {
        Self::default()
    }

    pub fn member(user_id: i64, role: Role) -> Self {
        Self {
            user_id: Some(user_id),
            role: Some(role),
        }
    }

    fn is_staff(&self) -> bool {
        self.role.map(Role::is_staff).unwrap_or(false)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Decision {
    Allow,
    /// The action needs an authenticated principal (HTTP 401).
    RequireAuth,
    /// The authenticated principal lacks the required role/ownership (HTTP 403).
    Deny,
}

#[derive(Debug, Clone, Copy)]
pub enum Action<'a> {
    /// Read works (list, facets, or detail) in the given moderation status.
    /// `owner_id` is the resource owner when known (detail), None for listings.
    ViewWorks {
        status: &'a str,
        owner_id: Option<i64>,
    },
    /// Read content carrying a shared content rating.
    ViewRated { rating: &'a str },
    /// Upload media or create/edit own fiction drafts.
    SubmitContent,
    /// Review queues, decisions, logs, and monitoring.
    Moderate,
}

pub fn decide(principal: &Principal, action: Action) -> Decision {
    match action {
        Action::ViewWorks { status: "approved", .. } => Decision::Allow,
        Action::ViewWorks { owner_id, .. } => {
            let Some(user_id) = principal.user_id else {
                return Decision::RequireAuth;
            };
            if owner_id == Some(user_id) {
                return Decision::Allow;
            }
            staff_only(principal)
        }
        Action::ViewRated { rating: "all_ages" } => Decision::Allow,
        Action::ViewRated { .. } => require_signed_in(principal),
        Action::SubmitContent => require_signed_in(principal),
        Action::Moderate => {
            if principal.user_id.is_none() {
                return Decision::RequireAuth;
            }
            staff_only(principal)
        }
    }
}

fn require_signed_in(principal: &Principal) -> Decision {
    if principal.user_id.is_some() {
        Decision::Allow
    } else {
        Decision::RequireAuth
    }
}

fn staff_only(principal: &Principal) -> Decision {
    if principal.is_staff() {
        Decision::Allow
    } else {
        Decision::Deny
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PrincipalError {
    /// Session store failure (HTTP 500).
    Session,
    /// Session references a user that no longer exists (HTTP 401).
    UnknownUser,
}

/// Load the caller's identity and role. A session pointing at a deleted user
/// is rejected rather than treated as anonymous.
pub async fn load_principal(
    db: &crate::db::DbPool,
    session: &Session,
) -> Result<Principal, PrincipalError> {
    let user_id: Option<i64> = session
        .get(SESSION_USER_ID_KEY)
        .await
        .map_err(|_| PrincipalError::Session)?;

    let Some(user_id) = user_id else {
        return Ok(Principal::anonymous());
    };

    let role: Option<String> = sqlx::query_scalar("SELECT role::TEXT FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(db)
        .await
        .map_err(|_| PrincipalError::Session)?;

    let role = role
        .as_deref()
        .and_then(Role::parse)
        .ok_or(PrincipalError::UnknownUser)?;

    Ok(Principal::member(user_id, role))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn anon() -> Principal {
        Principal::anonymous()
    }

    fn member() -> Principal {
        Principal::member(1, Role::Member)
    }

    fn moderator() -> Principal {
        Principal::member(2, Role::Moderator)
    }

    fn admin() -> Principal {
        Principal::member(3, Role::Admin)
    }

    fn stale() -> Principal {
        // Authenticated session without a resolvable role (defensive default).
        Principal {
            user_id: Some(9),
            role: None,
        }
    }

    #[test]
    fn work_visibility_matrix_is_deny_by_default() {
        use Decision::*;

        // (principal, status, owner_id, expected)
        let cases: &[(&str, Principal, &str, Option<i64>, Decision)] = &[
            // Approved works are public regardless of principal.
            ("anon/approved", anon(), "approved", None, Allow),
            ("member/approved", member(), "approved", None, Allow),
            // Listings of non-approved works are staff-only.
            ("anon/pending", anon(), "pending", None, RequireAuth),
            ("member/pending", member(), "pending", None, Deny),
            ("stale/pending", stale(), "pending", None, Deny),
            ("moderator/pending", moderator(), "pending", None, Allow),
            ("admin/pending", admin(), "pending", None, Allow),
            ("anon/rejected", anon(), "rejected", None, RequireAuth),
            ("member/takedown", member(), "takedown", None, Deny),
            ("admin/takedown", admin(), "takedown", None, Allow),
            // Owners may read their own non-approved detail.
            ("owner/pending", member(), "pending", Some(1), Allow),
            ("other/pending", member(), "pending", Some(42), Deny),
            ("anon/pending-owned", anon(), "pending", Some(1), RequireAuth),
            ("moderator/other-pending", moderator(), "pending", Some(42), Allow),
        ];

        for (name, principal, status, owner_id, expected) in cases {
            assert_eq!(
                decide(principal, Action::ViewWorks { status, owner_id: *owner_id }),
                *expected,
                "case {}",
                name
            );
        }
    }

    #[test]
    fn rated_content_requires_auth_beyond_all_ages() {
        use Decision::*;

        let cases: &[(&str, Principal, &str, Decision)] = &[
            ("anon/all_ages", anon(), "all_ages", Allow),
            ("anon/r15", anon(), "r15", RequireAuth),
            ("anon/r18", anon(), "r18", RequireAuth),
            ("member/r15", member(), "r15", Allow),
            ("member/r18", member(), "r18", Allow),
            ("stale/r18", stale(), "r18", Allow),
        ];

        for (name, principal, rating, expected) in cases {
            assert_eq!(
                decide(principal, Action::ViewRated { rating }),
                *expected,
                "case {}",
                name
            );
        }
    }

    #[test]
    fn submit_and_moderate_matrix() {
        use Decision::*;

        assert_eq!(decide(&anon(), Action::SubmitContent), RequireAuth);
        assert_eq!(decide(&member(), Action::SubmitContent), Allow);
        assert_eq!(decide(&moderator(), Action::SubmitContent), Allow);

        assert_eq!(decide(&anon(), Action::Moderate), RequireAuth);
        assert_eq!(decide(&member(), Action::Moderate), Deny);
        assert_eq!(decide(&stale(), Action::Moderate), Deny);
        assert_eq!(decide(&moderator(), Action::Moderate), Allow);
        assert_eq!(decide(&admin(), Action::Moderate), Allow);
    }

    #[test]
    fn role_parse_rejects_unknown_values() {
        assert_eq!(Role::parse("member"), Some(Role::Member));
        assert_eq!(Role::parse("moderator"), Some(Role::Moderator));
        assert_eq!(Role::parse("admin"), Some(Role::Admin));
        assert_eq!(Role::parse("root"), None);
        assert_eq!(Role::parse(""), None);
    }
}
