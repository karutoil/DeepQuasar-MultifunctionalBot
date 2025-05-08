# MongoDB Setup Instructions (Windows Server 2022)

## Option 1: Install MongoDB Community Edition Locally

1. **Download MongoDB Installer**
   - Go to: https://www.mongodb.com/try/download/community
   - Choose "Windows" and download the MSI installer.

2. **Run the Installer**
   - Double-click the downloaded `.msi` file.
   - Follow the setup wizard.
   - Choose "Complete" setup.
   - Select "Install MongoDB as a Service" (recommended).
   - Optionally, install MongoDB Compass (GUI).

3. **Finish Installation**
   - Complete the wizard and finish installation.

4. **Start MongoDB**
   - MongoDB should start automatically as a Windows service.
   - To check, open Command Prompt and run:
     ```
     net start MongoDB
     ```
   - By default, MongoDB listens on `localhost:27017`.

5. **Verify Installation**
   - Open Command Prompt and run:
     ```
     mongo
     ```
   - You should see the MongoDB shell prompt.

## Option 2: Use a Cloud MongoDB Provider

- You can use a free cloud MongoDB instance from [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
- Sign up, create a cluster, and get your connection string (URI).
- Update your `.env` and migration scripts to use this URI.

## Migrating Data from SQLite to MongoDB

If you are upgrading from a previous version that used SQLite, you need to migrate your data to MongoDB.

1. **Ensure MongoDB is running**  
   Start your MongoDB server (locally or via Docker/cloud).

2. **Set your MongoDB connection URI (if needed)**  
   By default, the migration scripts use `mongodb://localhost:27017` and the database name `musicbot`.  
   If your MongoDB is running elsewhere or requires authentication, set the `MONGODB_URI` environment variable before running the scripts:
   ```
   set MONGODB_URI=mongodb://your_mongo_host:your_port
   ```
   (On Linux/macOS, use `export` instead of `set`.)

3. **Run the migration scripts**  
   All migration scripts are located in the `scripts/` directory.  
   Run each script from your project root:
   ```
   python scripts\migrate_autorole_db_to_mongo.py
   python scripts\migrate_ticket_db_to_mongo.py
   python scripts\migrate_cog_state_db_to_mongo.py
   python scripts\migrate_embedcreator_db_to_mongo.py
   python scripts\migrate_localai_db_to_mongo.py
   python scripts\migrate_modlog_db_to_mongo.py
   python scripts\migrate_musicbot_db_to_mongo.py
   python scripts\migrate_welcome_leave_db_to_mongo.py
   ```

4. **Verify your data in MongoDB**  
   Use a MongoDB GUI (like MongoDB Compass) or the `mongo` shell to check that your data has been imported into the correct collections.

- If you use a custom URI, update the `MONGODB_URI` in your `.env` and migration scripts.
