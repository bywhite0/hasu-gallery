use clap::{Parser, Subcommand};

#[derive(Debug, Parser)]
#[command(
    name = "galleryd",
    version,
    about = "Hasu Gallery production binary (SPA + JSON API)"
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    /// Serve SPA and JSON API (default).
    Serve,
    /// Run database migrations and exit.
    Migrate,
    /// Print non-secret configuration diagnostics.
    Doctor,
    /// Isolated media worker (not implemented; hardening backlog).
    MediaWorker,
    /// Backfill legacy works into media_assets: approved works publish to
    /// public/{uuid}/v1/..., pending/rejected move to private/{uuid}/... and
    /// their legacy public objects are deleted.
    BackfillMedia,
}

impl Cli {
    pub fn parse_args() -> Self {
        Self::parse()
    }
}
