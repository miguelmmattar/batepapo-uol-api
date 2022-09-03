import express from 'express';
import cors from 'cors';
import dayjs from 'dayjs';
import { MongoClient } from 'mongodb';
import joi from 'joi';
import dotenv from 'dotenv';
dotenv.config();

const participantsSchema = joi.object({
    name: joi.string().empty().required()
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

        const validation = participantsSchema.validate(req.body, { abortEarly: false });

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

app.post('/messages', (req, res) => {
    const { to, text, type } = req.body;
    const  from  = req.headers.user;
    const time = dayjs().format('hh:mm:ss');

     if(!to || !text || !from || to === "" || text === "" || (type !== 'message' && type !== 'private_message')/*  || !participants.find(user => user === from) */) {
        res.status(422).send({message: 'Os campos devem ser preenchidos com informações válidas!'});
        return;
    }
    
    const message = {to, text, type, from, time};
    console.log(message);

    res.sendStatus(201);
});

app.get('/messages', (req, res) => {
    const limit = parseInt(req.query.limit);
    const { user } = req.headers;

    let allowed_messages = messages.filter(message => (message.to === user || message.from === user || message.type === 'private_message'));

    if(limit) {
        allowed_messages = allowed_messages.slice(limit * -1);
    }
   

    res.send(allowed_messages);
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