-- Create token_metadata table
CREATE TABLE IF NOT EXISTS token_metadata (
  id SERIAL PRIMARY KEY,
  pool_address VARCHAR(42) UNIQUE NOT NULL,
  token_address VARCHAR(42),
  name VARCHAR(255) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  image_url TEXT,
  description TEXT,
  website VARCHAR(255),
  telegram VARCHAR(255),
  twitter VARCHAR(255),
  deployment_block BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on pool_address for faster lookups
CREATE INDEX IF NOT EXISTS idx_token_metadata_pool_address ON token_metadata(pool_address);

-- Create index on token_address for faster lookups
CREATE INDEX IF NOT EXISTS idx_token_metadata_token_address ON token_metadata(token_address);

-- Create index on deployment_block for faster event queries
CREATE INDEX IF NOT EXISTS idx_token_metadata_deployment_block ON token_metadata(deployment_block);

-- Insert sample data (optional - remove if not needed)
-- INSERT INTO token_metadata (pool_address, name, symbol, image_url) 
-- VALUES ('0x7837ea3c8BEeBadb3A8CaaF1a6bb7E2CAE44B6a3', 'Squid Token', 'SQUID', 'https://tgudtpwnqvkjvwau.public.blob.vercel-storage.com/token-logos/1755034909658-squid.png')
-- ON CONFLICT (pool_address) DO NOTHING; 