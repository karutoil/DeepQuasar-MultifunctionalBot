import sqlite3
import sys

def export_schema_and_sample(db_path, sample_rows=5):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    print(f"Database: {db_path}")
    tables = [row[0] for row in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")]
    for table in tables:
        print(f"\nTable: {table}")
        # Print schema
        schema = cursor.execute(f"PRAGMA table_info({table})").fetchall()
        print("Schema:", schema)
        # Print sample rows
        rows = cursor.execute(f"SELECT * FROM {table} LIMIT {sample_rows}").fetchall()
        print("Sample rows:", rows)
    conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python export_sqlite_schema_and_sample.py <db_path>")
    else:
        export_schema_and_sample(sys.argv[1])
