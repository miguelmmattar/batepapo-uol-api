import express from 'express';
import cors from 'cors';
import dayjs from 'dayjs';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);

//essa parte vai mudar para usar o mongo
const participants = [];
const messages = [];

app.post('/participants', (req, res) => {
    const { name } = req.body;

    if(!name || name === "") {
        res.status(422).send({message: 'O campo deve ser preenchido com informações válidas!'});
        return;
    }
    
    //falta requisitos

    res.sendStatus(201);
});

app.get('/participants', (req, res) => {
    
    //falta popular a lista

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