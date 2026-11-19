import { NextRequest, NextResponse } from 'next/server';
import { readDiscovery } from '@/lib/discovery-server';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const seed = request.nextUrl.searchParams.get('seed') ?? '';
  const raw = request.nextUrl.searchParams.get('offset') ?? '';
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(seed) || !/^\d{1,6}$/.test(raw) || Number(raw) % 12 !== 0) return NextResponse.json({error:'Consulta no válida.'},{status:400});
  const saved = request.nextUrl.searchParams.get('ids');
  const ids = saved ? saved.split(',') : undefined;
  if ((Number(raw)%60!==0 && !ids) || (ids && (ids.length>60 || new Set(ids).size!==ids.length || ids.some(id=>!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))))) return NextResponse.json({error:'Consulta no válida.'},{status:400});
  try { return NextResponse.json(await readDiscovery(seed,Number(raw),Number(raw)%60===0?undefined:ids),{headers:{'Cache-Control':'no-store'}}); }
  catch { return NextResponse.json({error:'No pudimos cargar más productos.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
}
