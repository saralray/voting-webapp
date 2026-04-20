import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getResults, getVotesForExport } from "@/lib/data";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [results, votes] = await Promise.all([
      getResults(),
      getVotesForExport()
    ]);

    const workbook = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet(
      results.map((row) => ({
        Candidate: row.name,
        Votes: row.votes
      }))
    );
    const votesSheet = XLSX.utils.json_to_sheet(
      votes.map((row) => ({
        Voter: row.voter_iduser,
        Candidate: row.candidate_name
      }))
    );

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
    XLSX.utils.book_append_sheet(workbook, votesSheet, "Votes");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx"
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="voting-results.xlsx"'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate export." },
      { status: 500 }
    );
  }
}
