#!/usr/bin/env python3
"""Backfill whatsapp_messages desde Waha (Postgres directo). Uso puntual tras fix de índice."""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[1]


def load_db_url() -> str:
    env_path = ROOT / ".env"
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("SUPABASE_DB_URL="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("SUPABASE_DB_URL not found in .env")


def main() -> None:
    max_chats = int(os.environ.get("WA_BACKFILL_CHATS", "30"))
    per_chat = int(os.environ.get("WA_BACKFILL_LIMIT", "80"))

    conn = psycopg2.connect(load_db_url())
    cur = conn.cursor()
    cur.execute("SELECT company_id, api_key FROM whatsapp_config LIMIT 1")
    row = cur.fetchone()
    if not row:
        raise SystemExit("No whatsapp_config")
    company_id, api_key = row

    cur.execute(
        """
        SELECT chat_id FROM whatsapp_chats
        WHERE company_id = %s AND archived = false
        ORDER BY last_message_at DESC NULLS LAST
        LIMIT %s
        """,
        (company_id, max_chats),
    )
    chat_ids = [r[0] for r in cur.fetchall()]
    total = 0

    for chat_id in chat_ids:
        url = (
            f"http://192.168.99.110:3333/api/default/chats/"
            f"{urllib.parse.quote(chat_id, safe='')}/messages?limit={per_chat}"
        )
        req = urllib.request.Request(url, headers={"X-Api-Key": api_key})
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                msgs = json.loads(resp.read().decode())
        except Exception as e:
            print(f"skip {chat_id}: {e}")
            continue
        if not msgs:
            continue
        for m in msgs:
            waha_id = m.get("id")
            if not waha_id:
                continue
            ts = datetime.fromtimestamp(m["timestamp"], tz=timezone.utc)
            cur.execute(
                """
                INSERT INTO whatsapp_messages (
                  company_id, chat_id, waha_message_id, from_me, type, body,
                  caption, ack, timestamp, raw
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb)
                ON CONFLICT (company_id, waha_message_id)
                DO UPDATE SET body = EXCLUDED.body, timestamp = EXCLUDED.timestamp
                """,
                (
                    company_id,
                    chat_id,
                    waha_id,
                    bool(m.get("fromMe")),
                    m.get("type") or "text",
                    m.get("body"),
                    m.get("caption"),
                    int(m.get("ack") or 0),
                    ts,
                    json.dumps(m),
                ),
            )
            total += 1
        cur.execute(
            """
            UPDATE whatsapp_chats SET
              history_synced_at = COALESCE(history_synced_at, now()),
              oldest_message_at = (
                SELECT MIN(timestamp) FROM whatsapp_messages
                WHERE company_id = %s AND chat_id = %s
              )
            WHERE company_id = %s AND chat_id = %s
            """,
            (company_id, chat_id, company_id, chat_id),
        )
        conn.commit()
        print(f"{chat_id}: {len(msgs)} msgs")

    cur.execute("SELECT COUNT(*) FROM whatsapp_messages WHERE company_id = %s", (company_id,))
    print(f"Done. Total messages in DB: {cur.fetchone()[0]} (attempted upserts: {total})")
    conn.close()


if __name__ == "__main__":
    import urllib.parse  # noqa: E402

    main()
