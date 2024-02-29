const redis = require('redis')
const express = require('express')
const app = express()
const cors = require('cors')
const port = process.env.PORT || 3000

const client = redis.createClient({url: "redis://redis:6379"})

app.use(express.json())
client.on('error', err => console.log('Redis Client Error', err))
app.use(cors())

app.post("/setscore", async (req, res) => {
    console.log(req.body)
    if(req.body.request === "add_try") {
        let value = await client.get(req.body.ip)
        if(value === null) {
            value = {"wordFinded": 0, "try": 0}
        } else {
            value = JSON.parse(value)
        }
        value.try += 1

        await client.set(req.body.ip, JSON.stringify(value))
        res.send(`Success ${req.body.ip}`)
    } else if(req.body.request === "add_finded") {
        let value = await client.get(req.body.ip)
        if(value === null) {
            value = {"wordFinded": 0, "try": 0}
        } else {
            value = JSON.parse(value)
        }
        value.wordFinded += 1

        await client.set(req.body.ip, JSON.stringify(value))
        res.send(`Success ${req.body.ip}`)
    } else {
        res.send(`Error bad request`)
    }
})

app.post("/getscore", async (req, res) => {
    const ip = req.body.ip
    let value = await client.get(ip)
    if(value === null) {
        value = JSON.stringify({"wordFinded": 0, "try": 0})
    }
    res.send(value)
})

app.listen(port, async () => {
    await client.connect()
    console.log(`Example app listening on port ${port}`)
})