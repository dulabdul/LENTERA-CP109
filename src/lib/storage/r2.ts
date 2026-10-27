import "server-only";
import { S3Client } from "@aws-sdk/client-s3";
import { readEnvironment } from "../env";

// Factory only: no connectivity is claimed until a provider smoke test passes.
// Supplying explicit credentials prevents accidental use of another AWS project.
export function createR2Client() {
  const { server } = readEnvironment();
  if (!server.R2_ENDPOINT || !server.R2_BUCKET || !server.R2_ACCESS_KEY_ID || !server.R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 is not configured for Lentera");
  }
  return {
    bucket: server.R2_BUCKET,
    client: new S3Client({
      endpoint: server.R2_ENDPOINT,
      region: "auto",
      credentials: { accessKeyId: server.R2_ACCESS_KEY_ID, secretAccessKey: server.R2_SECRET_ACCESS_KEY },
    }),
  };
}
