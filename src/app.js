import express, { query } from "express"
import cors from "cors"
import dotenv from "dotenv"
import { MongoClient } from "mongodb"
import joi from "joi"
import dayjs from "dayjs"

const app = express()

app.use(express.json())
app.use(cors())
dotenv.config()

let db
const mongoClient = new MongoClient(process.env.DATABASE_URL)

mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => console.log(err.message))

app.post('/participants', async (req, res) => {
    const { name } = req.body
    const nameSchema = joi.object({
        name: joi.string().required()
    })

    const validation = nameSchema.validate(req.body)

    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }

    const newParticipant = { name, lastStatus: Date.now() }

    const newMessage = {
        from: name,
        to: 'todos',
        text: "entra na sala...",
        type: 'status',
        time: `${dayjs().hour() < 10 ? `0${dayjs().hour()}` : dayjs().hour()}:${dayjs().minute() < 10 ? `0${dayjs().minute()}` : dayjs().minute()}:${dayjs().second() < 10 ? `0${dayjs().second()}` : dayjs().second()}`
    }

    try {
        const logged = await db.collection('participants').findOne({ name: name })
        if (logged) return res.status(409).send("Esse nome já esta sendo usado por outro participante")

        await db.collection('participants').insertOne(newParticipant)

        await db.collection('messages').insertOne(newMessage)

        return res.sendStatus(201)
    } catch (err) {
        return res.status(500).send(err.message)
    }
})

app.get('/participants', async (req, res) => {
    try{
        const loggedParticipants = await db.collection('participants').find().toArray()

        res.send(loggedParticipants)
    }catch(err){
        return res.status(500).send(err.message)
    }
})

app.post('/messages', async (req,res)=>{
    const { to, text, type } = req.body
    const { user } = req.headers

    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.any().valid('message','private_message'),
    })

    const validation = messageSchema.validate(req.body)

    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }

    try{
        const fromValitation = await db.collection('participants').findOne({name: user})

        if(!fromValitation) return res.status(422).send('Esse usuário não está logado')
        
    }catch (err){
        return res.status(500).send(err.message)
    }

    const newMessage = {
        from: user,
        to,
        text,
        type,
        time: `${dayjs().hour() < 10 ? `0${dayjs().hour()}` : dayjs().hour()}:${dayjs().minute() < 10 ? `0${dayjs().minute()}` : dayjs().minute()}:${dayjs().second() < 10 ? `0${dayjs().second()}` : dayjs().second()}`
    }
    
    try{
        await db.collection('messages').insertOne(newMessage)
        
        return res.sendStatus(201)
    }catch (err){
        return res.status(500).send(err.message)
    }
})

app.get('/messages', async(req,res)=>{
    const {user} = req.headers
    const {limit} = req.query

    console.log(Number(limit))

    if(limit <=0 || !Number(limit)){
        console.log(limit)
        return res.status(422).send('campo limit inválido')
    }

    console.log("passou do teste di limit")

    try{
        const messagesArray = await db.collection('messages').find({
            $or: [{from: user}, {to: user}, {to: 'todos'}, {type: 'status'}, {type: 'message'}]
        }).toArray()

        if(limit >= messagesArray.length || !limit){
            return res.send(messagesArray)
        }

        if(limit < messagesArray.length){
            res.send(messagesArray.splice(-limit))
        }
    }catch (err){
        return res.status(500).send(err.message)
    }
})

app.listen(5000, () => console.log('app running on port 5000'))
