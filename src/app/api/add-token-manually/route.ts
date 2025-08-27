import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { poolAddress, name, symbol, imageUrl, description, website, telegram, twitter } = body;

    if (!poolAddress || !name || !symbol) {
      return NextResponse.json({ error: 'Missing required fields: poolAddress, name, symbol' }, { status: 400 });
    }

    // Insert or update token metadata in database
    const result = await sql`
      INSERT INTO token_metadata (pool_address, name, symbol, image_url, description, website, telegram, twitter, updated_at)
      VALUES (${poolAddress}, ${name}, ${symbol}, ${imageUrl || null}, ${description || null}, ${website || null}, ${telegram || null}, ${twitter || null}, CURRENT_TIMESTAMP)
      ON CONFLICT (pool_address) 
      DO UPDATE SET 
        name = EXCLUDED.name,
        symbol = EXCLUDED.symbol,
        image_url = EXCLUDED.image_url,
        description = EXCLUDED.description,
        website = EXCLUDED.website,
        telegram = EXCLUDED.telegram,
        twitter = EXCLUDED.twitter,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    console.log('✅ Manually added metadata to database for:', poolAddress);
    console.log('📦 Database result:', result.rows[0]);

    return NextResponse.json({ 
      success: true, 
      message: `Metadata added for ${name} (${symbol})`,
      poolAddress,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Manual add error:', error);
    return NextResponse.json({ error: 'Failed to add metadata' }, { status: 500 });
  }
} 