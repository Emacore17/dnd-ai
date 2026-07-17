import { forwardIdentityRequest } from "@/lib/server/identity-bff";

export async function POST(request: Request): Promise<Response> {
  return forwardIdentityRequest(request, "/api/auth/password-reset/request", {
    environment: process.env,
  });
}
