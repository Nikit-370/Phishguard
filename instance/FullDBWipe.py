import sqlite3

conn = sqlite3.connect("phishguard.db")
cursor = conn.cursor()

tables = ["users", "system_logs", "url_checks"]

for table in tables:
    cursor.execute(f"DELETE FROM {table}")

conn.commit()
conn.close()