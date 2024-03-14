const redis = require('redis')
const express = require('express')
const app = express()
const cors = require('cors')
const crypto = require('crypto')
const port = process.env.PORT || 3000
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const session = require('express-session')
const jwt = require('jsonwebtoken')
const loki_url = process.env.LOKI || "http://localhost:3100";
const {createLogger, transports} = require('winston')
const LokiTransport = require('winston-loki');
console.log(loki_url)
const options = {
    transports: [
        new LokiTransport({
            host: loki_url
        })
    ]
};

const logger = createLogger(options)

const client = redis.createClient({url: "redis://redis_auth:6379"})

app.use(express.json())
client.on('error', err => console.log('Redis Client Error', err))
app.use(cors())

app.set('view engine', 'ejs');

// Define the directory where your HTML files (views) are located
app.set('views', path.join(__dirname, 'views'));

app.set('trust proxy', 1) // trust first proxy

function generateCode() {
    return
}

app.use(session({
    secret: 'CY-Tech top 10 écoles post-bac',
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false }
}))

app.get('/authorize', async (req, res) => {
    const client_id = req.query.client_id
    const scope = req.query.scope
    const redirect_uri = req.query.redirect_uri
    logger.info({ message: 'New authorize session ', labels: { 'url': req.url, 'client_id':client_id, 'scope': scope, 'redirect_uri': redirect_uri } })

    if(!client_id || !scope || !redirect_uri) {
        logger.error({ message: 'Error while autorizing ', labels: { 'url': req.url, 'client_id':client_id, 'scope': scope, 'redirect_uri': redirect_uri }})
        res.render('error', {erreur: "Bad request"})
    }

    req.session.client_id = client_id
    req.session.scope = scope
    req.session.redirect_uri = redirect_uri
    await req.session.save()
    res.render('login')
})

app.get('/login', async (req, res) => {
    res.render('login')
})

app.get('/signin', (req, res) => {
    res.render('signin')
})

app.get('/authorize_process', async (req, res) => {
    const email = req.query.email
    const password = req.query.password
    logger.info({ message: 'Authorizing ', labels: { 'url': req.url, 'email':email }})
    try {
        const exist = await client.get(email)

        if(exist === null) {
            res.send(JSON.stringify({state: 'error', message: 'This email or password is wrong.'}))
            logger.error({ message: 'Not Authorized ', labels: { 'url': req.url, 'email':email}})
        } else {
            const hash = crypto.createHash("sha256").update(password).digest("hex")
            if(exist === hash) {
                const code = uuidv4()
                let redirect_uri = req.session.redirect_uri + `?code=${code}`
                console.log(redirect_uri)
                await client.set(code, JSON.stringify({email: email}))
                logger.info({ message: 'Authorized ', labels: { 'url': req.url, 'email':email }})
                let logs = await client.get('num_log_process')
                if(logs === null) {
                    logs = 1
                } else {
                    logs = parseInt(logs) + 1
                }
                await client.set('num_log_process', logs)

                res.redirect(redirect_uri)
            } else {
                res.render('error',{erreur: 'This email or password is wrong.'})
            }
        }
    } catch (error) {
        console.log(error)
        logger.error({ message: 'Error while authorizing process ', labels: { 'url': req.url, 'email':email, 'error': error}})
        res.render('error', {erreur: 'Something went wrong with signup'})
    }
})

app.get('/token', async (req, res) => {
    const code = req.query.code
    logger.info({message:"Token request ", labels:{'token':code}})
    if(!code) {
        res.render('error', {erreur: "No code provided"})
        logger.error({message:"Token request without code "})
    }

    const data = await client.get(code)

    if(!data) {
        logger.error({message:"Token request with bad code ", labels:{'code':code}})
        res.render('error', {erreur: "This code is wrong"})
    }

    const token = jwt.sign(JSON.parse(data), "sanpellegrino")

    res.send(token)
})

app.get('/metrics', async (req, res) => {
    let logs = await client.get('num_log_process')
    if(logs === null) {
        logs = 0
    }

    res.send(`num_log_process ${logs}`)
})

app.get('/signin_process', async (req, res) => {
    const email = req.query.email
    const password = req.query.password
    const password2 = req.query.password2
    logger.info({message:"Signin process ", labels:{'email':email}})
    if(password !== password2) {
        res.render('error', {erreur: "Les mots de passes sont différents"})
    }

    try {
        const exist = await client.get(email)

        if(exist !== null) {
            res.render('error', {erreur: 'This email is already registered.'})
        } else {
            const hash = crypto.createHash("sha256").update(password).digest("hex")
            try {
                await client.set(email, hash)
                logger.info({message:"Signin process successfull ", labels:{'email': email}})
                res.redirect(`/authorize?client_id=${req.session.client_id}&scope=${req.session.scope}&redirect_uri=${encodeURIComponent(req.session.redirect_uri)}`)
            } catch(error) {
                logger.error({message:"Signin process error ", labels:{'error':error}})
                res.render('error', {erreur: 'An error occured during creation of a new user.'})
            }
        }
    } catch (error) {
        console.log(error)
        logger.error({message:"Signin process error ", labels:{'error':error}})
        res.render('error', {erreur: 'Something went wrong with signin'})
    }
})

app.get('/session', (req, res) => {
    res.send(req.session)
})

app.get('/logout', async (req, res) => {
    req.session.user = null
    await req.session.save()
    res.redirect('/')
})

app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
})

app.listen(port, async () => {
    await client.connect()
    logger.info({message:"Auth application run on port "+port, labels:{'app': 'auth'}})
    console.log(`Example app listening on port ${port}`)
})