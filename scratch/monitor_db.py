import os
import re
import sys
import time
import json
import psycopg2

def get_db_url():
    # Read from frontend/.env or .env
    for env_path in ['frontend/.env', '.env']:
        if os.path.exists(env_path):
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('DATABASE_URL='):
                        val = line.split('=', 1)[1].strip()
                        if val.startswith('"') and val.endswith('"'):
                            val = val[1:-1]
                        elif val.startswith("'") and val.endswith("'"):
                            val = val[1:-1]
                        return val
    return os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/cityconnect')

def main():
    db_url = get_db_url()
    out_file = os.path.join(os.path.dirname(__file__), 'db_monitor.json')
    
    # Initialize monitor file
    data = {
        "max_connections_limit": 100,
        "max_active_observed": 0,
        "max_total_observed": 0,
        "samples_count": 0,
        "history": []
    }
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

    print(f"[DB Monitor] Starting PostgreSQL connection monitor targeting database...")
    sys.stdout.flush()

    while True:
        try:
            conn = psycopg2.connect(db_url, connect_timeout=3)
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT
                        count(*) as total,
                        count(*) FILTER (WHERE state = 'active') as active,
                        count(*) FILTER (WHERE state = 'idle') as idle,
                        count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_trans,
                        count(*) FILTER (WHERE wait_event_type IS NOT NULL) as waiting
                    FROM pg_stat_activity
                    WHERE datname = current_database();
                """)
                row = cur.fetchone()
                total, active, idle, idle_in_trans, waiting = row

                # Also get max_connections if not fetched
                cur.execute("SHOW max_connections;")
                max_conn = int(cur.fetchone()[0])
            conn.close()

            # Read existing
            try:
                with open(out_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except Exception:
                pass

            data["max_connections_limit"] = max_conn
            data["samples_count"] = data.get("samples_count", 0) + 1
            if active > data.get("max_active_observed", 0):
                data["max_active_observed"] = active
            if total > data.get("max_total_observed", 0):
                data["max_total_observed"] = total

            sample = {
                "timestamp": time.time(),
                "time_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "total_connections": total,
                "active_connections": active,
                "idle_connections": idle,
                "idle_in_transaction": idle_in_trans,
                "waiting_queries": waiting
            }

            # Retain last 300 samples
            history = data.get("history", [])
            history.append(sample)
            if len(history) > 300:
                history = history[-300:]
            data["history"] = history

            with open(out_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)

        except Exception as e:
            # print error once every few iterations to not spam
            pass

        time.sleep(5)

if __name__ == "__main__":
    main()
