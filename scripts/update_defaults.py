import sqlite3
import os

DB_PATH = os.path.join('data', 'localai.db')

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create migrations table if not exists
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS migrations (
            name TEXT PRIMARY KEY
        )
    ''')

    # Check if migration already done
    cursor.execute('SELECT 1 FROM migrations WHERE name = "default_config_update"')
    if cursor.fetchone():
        print("Migration already applied. No changes made.")
        conn.close()
        return

    # Update all existing configs with new defaults
    cursor.execute('''
        UPDATE ai_config
        SET api_base = 'http://192.168.0.12:1234',
            api_key = 'lm-studio',
            model_name = 'fusechat-llama-3.2-3b-instruct'
    ''')
    conn.commit()

    # Mark migration as done
    cursor.execute('INSERT INTO migrations (name) VALUES ("default_config_update")')
    conn.commit()

    print("Default config values updated for all existing entries.")

    conn.close()

if __name__ == "__main__":
    main()
