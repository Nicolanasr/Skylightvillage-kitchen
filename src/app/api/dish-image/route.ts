import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return new NextResponse('Missing item ID', { status: 400 });
  }

  if (!pool) {
    return new NextResponse('Database connection error', { status: 500 });
  }

  try {
    const res = await pool.query('SELECT image_url FROM menu_items WHERE id = $1', [id]);
    if (res.rows.length === 0 || !res.rows[0].image_url) {
      return new NextResponse('Image not found', { status: 404 });
    }

    const rawUrl = res.rows[0].image_url;

    if (!rawUrl.startsWith('data:image/')) {
      // External URL redirect or error fallback
      return NextResponse.redirect(rawUrl);
    }

    // Parse data:image/png;base64,...
    const matches = rawUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length < 3) {
      return new NextResponse('Invalid base64 image data', { status: 400 });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const imageBuffer = Buffer.from(base64Data, 'base64');

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': `image/${mimeType}`,
        'Content-Length': imageBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (e: any) {
    console.error('Error serving dish image:', e);
    return new NextResponse('Server error', { status: 500 });
  }
}
