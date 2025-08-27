import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { poolAddress } = body;

    if (!poolAddress) {
      return NextResponse.json({ error: 'Missing required field: poolAddress' }, { status: 400 });
    }

    // Delete token metadata from database
    const result = await sql`
      DELETE FROM token_metadata 
      WHERE pool_address = ${poolAddress}
      RETURNING *;
    `;

    if (result.rows.length > 0) {
      console.log('✅ Removed metadata from database for:', poolAddress);
      console.log('📦 Deleted data:', result.rows[0]);
      return NextResponse.json({ 
        success: true, 
        message: `Metadata removed for ${poolAddress}`,
        data: result.rows[0]
      });
    } else {
      console.log('⚠️ No metadata found in database for:', poolAddress);
      return NextResponse.json({ 
        success: false, 
        message: `No metadata found for ${poolAddress}` 
      }, { status: 404 });
    }
  } catch (error) {
    console.error('Remove metadata error:', error);
    return NextResponse.json({ error: 'Failed to remove metadata' }, { status: 500 });
  }
} 