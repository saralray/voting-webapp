import { NextResponse } from "next/server";
import { getDashboardSummary, getResults } from "@/lib/data";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [summary, results] = await Promise.all([
      getDashboardSummary(),
      getResults()
    ]);

    return NextResponse.json({
      summary,
      results
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Database is temporarily unavailable." },
      { status: 503 }
    );
  }
}
