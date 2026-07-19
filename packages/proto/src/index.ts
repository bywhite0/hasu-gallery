/**
 * Generated Architecture V2 Protobuf contracts for the browser.
 *
 * Keep the media type here so API clients do not duplicate the transport
 * contract. The generated message schemas are the source of truth for binary
 * encoding and decoding; do not hand-roll JSON-shaped lookalikes for /api/v2.
 */

export const PROTO_MEDIA_TYPE =
  "application/vnd.hasu-gallery.v2+protobuf" as const;

export {
  create,
  fromBinary,
  toBinary,
  type DescMessage,
  type MessageInitShape,
  type MessageShape,
} from "@bufbuild/protobuf";

export * from "./gen/hasu/gallery/v2/common_pb";
export * from "./gen/hasu/gallery/v2/fiction_pb";
export * from "./gen/hasu/gallery/v2/works_pb";
