# Data Migration Instructions: sqlite3 to MongoDB

## 1. Start MongoDB and Services

If you haven't already, start your services (including MongoDB) with Docker Compose:

```
docker-compose up -d
```

This will start the `mongodb` service and make it available to your application and migration scripts.

## 2. Run the Migration Script for ticket.db

With MongoDB running, run the migration script to import data from `data/ticket.db`:

```
python migrate_ticket_db_to_mongo.py
```

This will migrate the `ticket_settings` and `tickets` tables to MongoDB.

## 3. Repeat for Other Databases

You will need to migrate data from the following sqlite3 databases as well:

- autorole.db
- embedcreator.db
- localai.db
- modlog.db
- musicbot.db
- welcome_leave.db

For each database, a similar migration script should be created (as was done for `ticket.db`). Each script should:
- Read all rows from each table.
- Convert any stringified lists to Python lists.
- Insert each row as a document into the corresponding MongoDB collection.

## 4. Verify Data

After running each migration script, verify that the data appears in MongoDB as expected.

## 5. Update Application

Once all data is migrated, your application will use MongoDB for all persistent storage.

---

**Note:** If you need migration scripts for the other databases, let me know which one to do next and I will generate it for you.
