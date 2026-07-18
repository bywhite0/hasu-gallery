pub mod markup;
pub mod service;

pub use markup::excerpt_from_plain;
pub use service::{
    CreateFictionInput, create_fiction_draft, decide_revision, save_draft_revision, submit_revision,
};
