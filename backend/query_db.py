import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def run():
    conn = await asyncpg.connect(os.environ['SUPABASE_DB_URL'])
    rows = await conn.fetch('SELECT id, full_name, role, teacher_id FROM admin_users')
    for r in rows:
        print(dict(r))
    await conn.close()

asyncio.run(run())
