const redis = require('redis')
const express = require('express')
const app = express()
const cors = require('cors')
const port = process.env.PORT || 3000

const client = redis.createClient({url: "redis://redis_score:6379"})

app.use(express.json())
client.on('error', err => console.log('Redis Client Error', err))
app.use(cors())

app.post("/setscore", async (req, res) => {
    console.log(req.body)
    if(req.body.request === "add_try") {
        let value = await client.get(req.body.email)
        if(value === null) {
            value = {"wordFinded": 0, "try": 0}
        } else {
            value = JSON.parse(value)
        }
        value.try += 1

        await client.set(req.body.email, JSON.stringify(value))
        res.send(`Success ${req.body.email}`)
    } else if(req.body.request === "add_finded") {
        let value = await client.get(req.body.email)
        if(value === null) {
            value = {"wordFinded": 0, "try": 0}
        } else {
            value = JSON.parse(value)
        }
        value.wordFinded += 1

        await client.set(req.body.email, JSON.stringify(value))
        res.send(`Success ${req.body.email}`)
    } else {
        res.send(`Error bad request`)
    }
})

app.post("/getscore", async (req, res) => {
    const email = req.body.email
    let value = await client.get(email)
    if(value === null) {
        value = JSON.stringify({"wordFinded": 0, "try": 0})
    }
    res.send(value)
})

app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
})

app.listen(port, async () => {
    await client.connect()
    console.log(`Example app listening on port ${port}`)
})