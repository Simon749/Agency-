import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export default defineConfig({
  // This pattern looks inside db/ and any subfolders for .ts files
  schema: './db/schema/**/*.ts', 
  out: './db/migrations', // Matches your existing migrations folder
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});