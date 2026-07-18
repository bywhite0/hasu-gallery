use clap::{Parser, Subcommand};

#[derive(Debug, Parser)]
#[command(
    name = "galleryd",
    version,
    about = "Hasu Gallery production binary (SPA + JSON API + /api/v2)"
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    /// Serve SPA, JSON API, and V2 Protobuf routes (default).
    Serve,
    /// Run database migrations and exit.
    Migrate,
    /// Print non-secret configuration diagnostics.
    Doctor,
    /// Isolated media worker (not implemented in Slice A).
    MediaWorker,
}

impl Cli {
    pub fn parse_args() -> Self {
        Self::parse()
    }
}
