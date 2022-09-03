import express from 'express';
import cors from 'cors';
import dayjs from 'dayjs';
import { MongoClient } from 'mongodb';
import joi from 'joi';
import dotenv from 'dotenv';
dotenv.config();

const participantSchema = joi.object({
    name: joi.string().empty().required()
});

const messageSchema = joi.object({
    to: joi.string().empty().required(),
    text: joi.string().empty().required(),
    type: joi.valid('message', 'private_message').required()
});

const app = express();
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect(() => {
    db = mongoClient.db('bate_papo_uol');
});

app.use(cors());
app.use(express.json());

//essa parte vai mudar para usar o mongo
const participants = [];
const messages = [];

app.post('/participants', async (req, res) => {
    const { name } = req.body;

    try {
        const response = await db
            .collection('participants')
            .findOne({name: name});

        if(response) {
            res.status(409).send('Este nome já existe! Tente outro.');
            return;
        }

        const validation = participantSchema.validate(req.body, { abortEarly: false });

        if(validation.error) {
            const errors = validation.error.details.map(detail => detail.message);
            res.status(422).send(errors);
            return;
        }

        await db
            .collection('participants')
            .insertOne({
                name,
                lastStatus: Date.now()
            });

        await db
            .collection('messages')
            .insertOne({
                from: name, 
                to: 'Todos', 
                text: 'entra na sala...', 
                type: 'status', 
                time: dayjs().format('hh:mm:ss')
            });

        res.sendStatus(201);
    } catch(error) {
        res.status(500).send(error.message);
    }
});

app.get('/participants', async (req, res) => {
    try {
        res.send(await db
            .collection('participants')
            .find()
            .toArray()
        );        
    } catch(error) {
        res.status(500).send(error.message);
    }

    res.send(participants);
});

app.post('/messages', async (req, res) => {
    const { to, text, type } = req.body;
    const  from  = req.headers.user;

    try {
        const response = await db
            .collection('participants')
            .findOne({name: from});

        const validation = messageSchema.validate(req.body, { abortEarly: false });

        if(!response ) {
            res.status(422).send('Este participante não existe!');
        }

        if(validation.error) {
            const errors = validation.error.details.map(detail => detail.message);
            res.status(422).send(errors);
        }

        await db
            .collection('messages')
            .insertOne({
                from, 
                to, 
                text, 
                type, 
                time: dayjs().format('hh:mm:ss')
            });

        res.sendStatus(201);
    } catch(error) {
        res.status(500).send(error.message);
    }  
});

app.get('/messages', async (req, res) => {
    const limit = parseInt(req.query.limit);
    const { user } = req.headers;

    try {
        let response = await db
            .collection('messages')
            .find()
            .toArray();
            
        let allowed_messages = response.filter(message => (message.to === user || 
            message.from === user || 
            message.type === 'message'));

        if(limit) {
            allowed_messages = allowed_messages.slice(limit * -1);
        }

        res.send(allowed_messages);
    } catch(error) {
        res.status(500).send(error.message);
    }   
});

app.post('/status', (req, res) => {
    const { user } = req.headers;
    const i = participants.indexOf(participants.find(participant => participant.name === user));

    if(i === -1) {
        res.sendStatus(404);
        return;
    }

    participants[i].lastStaus = Date.now();

    res.sendStatus(200);
});

setInterval(() => {
    participants.forEach((participant, index) => {
        if(Date.now() - participants.lastStatus > 10000) {
            participants.splice(index, 1);
        }
    });
    
}, 15000);


app.listen(5000, () => console.log('Listening on port 5000'));