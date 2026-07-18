use std::path::PathBuf;

fn main() {
    let proto_root = PathBuf::from("../proto");
    let proto_files = [
        proto_root.join("hasu/gallery/v2/common.proto"),
        proto_root.join("hasu/gallery/v2/fiction.proto"),
    ];

    for proto_file in &proto_files {
        println!("cargo:rerun-if-changed={}", proto_file.display());
    }

    let protoc = protoc_bin_vendored::protoc_bin_path().expect("vendored protoc is available");
    std::env::set_var("PROTOC", protoc);

    prost_build::Config::new()
        .compile_protos(&proto_files, &[proto_root])
        .expect("Protobuf contracts should compile");
}
