import { handleAnalyzeRequest } from "@/app/api/analyze/route";

export async function POST(request: Request) {
  return handleAnalyzeRequest(request, { workspace: "connections" });
}
