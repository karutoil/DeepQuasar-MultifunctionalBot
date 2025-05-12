const { getDb } = require('./database');

class ReminderModel {
    static async create(reminder) {
        const db = getDb();
        const remindersCollection = db.collection('reminders');
        return await remindersCollection.insertOne(reminder);
    }

    static async deleteById(id) {
        const db = getDb();
        const remindersCollection = db.collection('reminders');
        return await remindersCollection.deleteOne({ _id: id });
    }

    static async findAll() {
        const db = getDb();
        const remindersCollection = db.collection('reminders');
        return await remindersCollection.find().toArray();
    }

    static async findById(id) {
        const db = getDb();
        const remindersCollection = db.collection('reminders');
        return await remindersCollection.findOne({ _id: id });
    }
}

module.exports = ReminderModel;
