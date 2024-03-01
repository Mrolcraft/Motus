const redis = require('redis')
const express = require('express')
const app = express()
const cors = require('cors')
const crypto = require('crypto')
const port = process.env.PORT || 3000

const client = redis.createClient({url: "redis://redis_auth:6379"})

app.use(express.json())
client.on('error', err => console.log('Redis Client Error', err))
app.use(cors())

app.post('/signin', async (req, res) => {
    const email = req.body.email
    const password = req.body.password

    const exist = await client.get(email)

    if(exist !== null) {
        res.send(JSON.stringify({state: 'error', message: 'This email is already registered.'}))
    } else {
        const hash = crypto.createHash("sha256").update(password).digest("hex")
        try {
            await client.set(email, hash)
            res.send({state: 'success', message: 'Successfull'})
        } catch(error) {
            res.send({state: 'error', message: 'An error occured during creation of a new user'})
        }
    }
})

app.post('/signup', async (req, res) => {
    const email = req.body.email
    const password = req.body.password
    
    const exist = await client.get(email)
    
    if(exist === null) {
        res.send(JSON.stringify({state: 'error', message: 'This email or password is wrong.'}))
    } else {
        const hash = crypto.createHash("sha256").update(password).digest("hex")
        if(exist === hash) {
            res.send(JSON.stringify({state: 'success', message: 'Successfull'}))
        } else {
            res.send(JSON.stringify({state: 'error', message: 'This email or password is wrong.'}))
        }
    }
})

app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
})

app.listen(port, async () => {
    await client.connect()
    console.log(`Example app listening on port ${port}`)
})