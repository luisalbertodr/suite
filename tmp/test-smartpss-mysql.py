import os, json
try:
    import MySQLdb
except ImportError:
    import pymysql as MySQLdb

host = os.environ.get("H", "192.168.99.110")
conn = MySQLdb.connect(
    host=host,
    port=3306,
    user="root",
    passwd="Lip0cer0",
    db="smartpss_events",
    connect_timeout=5,
)
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM AttendanceRecordInfo")
total = cur.fetchone()[0]
cur.execute(
    "SELECT PersonID, PersonName, AttendanceDateTime, AttendanceState, DeviceName "
    "FROM AttendanceRecordInfo ORDER BY AttendanceDateTime DESC LIMIT 5"
)
rows = cur.fetchall()
print(json.dumps({"ok": True, "host": host, "total": total, "rows": [list(r) for r in rows]}, default=str))
conn.close()
