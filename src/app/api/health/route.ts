import { NextResponse } from 'next/server';

/**
 * Health check endpoint
 */
export async function GET(request: Request) {
  return NextResponse.json({ status: 'ok' });
}
