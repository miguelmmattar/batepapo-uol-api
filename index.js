import express, { response } from 'express';
import cors from 'cors';
import dayjs from 'dayjs';
import { MongoClient, ObjectId } from 'mongodb';
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
            return;
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

app.post('/status', async (req, res) => {
    const { user } = req.headers;
    
    try {
        const response = await db
            .collection('participants')
            .findOne({ name: user });

        if(!response) {
            res.sendStatus(404);
            return;
        }

        await db 
            .collection('participants')
            .updateOne({ name: user }, { $set: {
                lastStatus: Date.now()
            } 
        });

        res.sendStatus(200);
    } catch(error) {
        res.status(500).send(error.message);
    }   
});

app.delete('/messages/:messageId', async (req, res) => {
    const { user } = req.headers;
    const { messageId } = req.params;

    try {
        let response = await db
            .collection('messages')
            .findOne({ _id: ObjectId(messageId) });

        if(!response) {
            res.status(404).send('Não foi possível encontrar esta mensagem!');
            return;
        }

        if(user !== response.from) {
            res.status(401).send('Não é possível deletar mensagens de outros participantes!');
            return;
        }
        
        response = await db
            .collection('messages')
            .deleteOne({ _id: ObjectId(messageId) });

        res.send(response);
    } catch(error) {
        res.status(500).send(error.message);
    }
});

app.put('/messages/:messageId', async (req, res) => {
    const { to, text, type } = req.body;
    const from = req.headers.user;
    const { messageId } = req.params;

    try {
        let response = await db
            .collection('participants')
            .findOne({name: from});

        const validation = messageSchema.validate(req.body, { abortEarly: false });

        if(!response ) {
            res.status(422).send('Este participante não existe!');
        }

        if(validation.error) {
            const errors = validation.error.details.map(detail => detail.message);
            res.status(422).send(errors);
            return;
        }

        response = await db
            .collection('messages')
            .findOne({ _id: ObjectId(messageId) });

        if(!response) {
            res.status(404).send('Não foi possível encontrar esta mensagem!');
            return;
        }

        if(from !== response.from) {
            res.status(401).send('Não é possível deletar mensagens de outros participantes!');
            return;
        }

        await db
            .collection('messages')
            .updateOne({ _id: ObjectId(messageId) }, { $set: {
                to,
                text,
                type
            } 
        });

        res.sendStatus(200);
    } catch(error) {
        res.status(500).send(error.message);
    }
});

async function autoRemove() {
    try {
        const toRemove = await db
            .collection('participants')
            .find({ lastStatus: {$lt: (Date.now() - 10)}})
            .toArray();

        await toRemove.forEach(participant => {
            db
                .collection('messages')
                .insertOne({
                    from: participant.name, 
                    to: 'Todos', 
                    text: 'sai da sala...', 
                    type: 'status', 
                    time: dayjs().format('hh:mm:ss')
                });

            db
                .collection('participants')
                .deleteOne({ name: participant.name });
        });
        } catch(error) {
            console.log(error.message);
        }       
}

setInterval(autoRemove, 15000);

app.listen(5000, () => console.log('Listening on port 5000'));