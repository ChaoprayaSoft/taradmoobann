import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const roles = (session?.user as any)?.roles || [];
    
    if (!session || !roles.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit") || "100";
    const limit = parseInt(limitParam, 10);

    const logsSnapshot = await adminDb
      .collection("activity_logs")
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    const logs = logsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userEmail: data.userEmail,
        action: data.action,
        details: data.details,
        timestamp: data.timestamp ? (typeof data.timestamp.toDate === 'function' ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString()) : new Date().toISOString()
      };
    });

    // Calculate aggregated metrics for the dashboard (using the fetched logs)
    // In a real large scale app, this would be pre-calculated or queried specifically
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todayLogins = 0;
    const uniqueUsersToday = new Set<string>();
    const pageVisitsToday: Record<string, number> = {};

    logs.forEach(log => {
      const logDate = new Date(log.timestamp);
      if (logDate >= today) {
        if (log.action === "LOGIN") {
          todayLogins++;
        }
        if (log.userEmail !== "anonymous") {
          uniqueUsersToday.add(log.userEmail);
        }
        if (log.action === "VISIT") {
          pageVisitsToday[log.details] = (pageVisitsToday[log.details] || 0) + 1;
        }
      }
    });

    // Find top visited page
    let topPage = "None";
    let maxVisits = 0;
    for (const [page, count] of Object.entries(pageVisitsToday)) {
      if (count > maxVisits) {
        maxVisits = count;
        topPage = page;
      }
    }

    return NextResponse.json({ 
      success: true, 
      logs,
      metrics: {
        todayLogins,
        uniqueUsersToday: uniqueUsersToday.size,
        topPage: `${topPage} (${maxVisits})`
      }
    });
  } catch (error: any) {
    console.error("Failed to fetch logs:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
