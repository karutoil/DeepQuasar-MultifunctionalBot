import subprocess
import sys
import os

SCRIPTS = [
    "migrate_autorole_db_to_mongo.py",
    "migrate_ticket_db_to_mongo.py",
    "migrate_cog_state_db_to_mongo.py",
    "migrate_embedcreator_db_to_mongo.py",
    "migrate_localai_db_to_mongo.py",
    "migrate_modlog_db_to_mongo.py",
    "migrate_musicbot_db_to_mongo.py",
    "migrate_welcome_leave_db_to_mongo.py",
]

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    python_exe = sys.executable

    for script in SCRIPTS:
        script_path = os.path.join(script_dir, script)
        print(f"\n=== Running {script} ===")
        result = subprocess.run([python_exe, script_path], capture_output=True, text=True)
        print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        if result.returncode != 0:
            print(f"Error: {script} failed with exit code {result.returncode}", file=sys.stderr)
            break

if __name__ == "__main__":
    main()
