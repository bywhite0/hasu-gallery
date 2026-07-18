pub mod hasu {
    pub mod gallery {
        pub mod v2 {
            include!(concat!(env!("OUT_DIR"), "/hasu.gallery.v2.rs"));
        }
    }
}
