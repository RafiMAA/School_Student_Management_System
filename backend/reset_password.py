"""One-off legacy password-hash repair tool.

Database credentials must come from the environment and the replacement
password is entered interactively so neither value is stored in source code.
"""
import asyncio
import getpass
import os

import asyncpg
import bcrypt


def hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


async def main():
    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        raise SystemExit("SUPABASE_DB_URL must be set in the environment.")

    new_password = getpass.getpass("Replacement password: ")
    confirmation = getpass.getpass("Confirm replacement password: ")
    if new_password != confirmation:
        raise SystemExit("Passwords do not match.")
    if len(new_password) < 12:
        raise SystemExit("Use a password with at least 12 characters.")

    conn = await asyncpg.connect(db_url)

    rows = await conn.fetch("SELECT id, username, password_hash FROM teachers")
    print(f"\n--- Found {len(rows)} teachers ---")

    new_hash = hash_pw(new_password)

    for r in rows:
        ph = r["password_hash"] or "(NULL)"
        is_valid = ph.startswith("$2") and len(ph) == 60
        print(f"  {r['username']:15s}  valid_hash={is_valid}  preview={ph[:30]}...")

        if not is_valid:
            await conn.execute(
                "UPDATE teachers SET password_hash = $1 WHERE id = $2",
                new_hash, r["id"],
            )
            print("    Fixed invalid password hash.")

    await conn.close()
    print("\nDone. The replacement password was not written to logs.")


if __name__ == "__main__":
    asyncio.run(main())
