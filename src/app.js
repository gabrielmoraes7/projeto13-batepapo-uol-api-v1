import express from 'express';
import { config } from 'dotenv';
import { MongoClient } from 'mongodb';
import Joi from 'joi';
import dayjs from 'dayjs';

config();
const app = express();
const port = 5000;
const mongoClient = new MongoClient(process.env.DATABASE_URL);
app.use(express.json());

app.post('/participants', async (req, res) => {
    const { name } = req.body;
    const schema = Joi.object({
        name: Joi.string().required()
    });
    const validation = schema.validate({ name });
    if (validation.error) {
        return res.sendStatus(422);
    }
    const db = mongoClient.db();
    const participantsCollection = db.collection('participants');
    const participantExists = await participantsCollection.findOne({ name });
    if (participantExists) {
        return res.sendStatus(409);
    }
    await participantsCollection.insertOne({
        name,
        lastStatus: Date.now()
    });
    const messagesCollection = db.collection('messages');
    await messagesCollection.insertOne({
        from: name,
        to: 'Todos',
        text: 'entra na sala...',
        type: 'status',
        time: dayjs().format('HH:mm:ss')
    });
    res.sendStatus(201);
});


app.get('/participants', async (req, res) => {
    const db = mongoClient.db();
    const participantsCollection = db.collection('participants');
    const participants = await participantsCollection.find().toArray();
    res.json(participants);
});


app.post('/messages', async (req, res) => {
    const { to, text, type } = req.body;
    const from = req.headers.user;
    const schema = Joi.object({
        to: Joi.string().required(),
        text: Joi.string().required(),
        type: Joi.string().valid('message', 'private_message').required(),
        from: Joi.string().required()
    });
    const validation = schema.validate({ to, text, type, from });
    if (validation.error) {
        return res.sendStatus(422);
    }
    const db = mongoClient.db();
    const participantsCollection = db.collection('participants');
    const participantExists = await participantsCollection.findOne({ name: from });
    if (!participantExists) {
        return res.sendStatus(422);
    }
    const messagesCollection = db.collection('messages');
    await messagesCollection.insertOne({
        from,
        to,
        text,
        type,
        time: dayjs().format('HH:mm:ss')
    });
    res.sendStatus(201);
});

app.get('/messages', async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    if (limit !== null && (isNaN(limit) || limit <= 0)) {
        return res.sendStatus(422);
    }
    const user = req.headers.user;
    const db = mongoClient.db();
    const messagesCollection = db.collection('messages');
    let messages;
    if (limit === null) {
        messages = await messagesCollection.find({
            $or: [
                { to: 'Todos' },
                { to: user },
                { from: user }
            ]
        }).toArray();
    } else {
        messages = await messagesCollection.find({
            $or: [
                { to: 'Todos' },
                { to: user },
                { from: user }
            ]
        }).sort({ _id: -1 }).limit(limit).toArray();
        messages.reverse();
    }
    res.json(messages);
});

app.post('/status', async (req, res) => {
    const user = req.headers.user;
    if (!user) {
        return res.sendStatus(404);
    }
    const db = mongoClient.db();
    const participantsCollection = db.collection('participants');
    const participantExists = await participantsCollection.findOne({ name: user });
    if (!participantExists) {
        return res.sendStatus(404);
    }
    await participantsCollection.updateOne(
        { name: user },
        { $set: { lastStatus: Date.now() } }
    );
    res.sendStatus(200);
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
