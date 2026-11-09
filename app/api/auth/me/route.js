import { currentUser, publicUser } from '../../../server/auth';
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export async function GET() { try { const user = await currentUser(); return NextResponse.json({ user: user ? publicUser(user) : null }, { status: user ? 200 : 401 }); } catch { return NextResponse.json({ user: null }, { status: 401 }); } }
