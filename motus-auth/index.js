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

    if(!client_id || !scope || !redirect_uri) {
        res.render('error', {erreur: "Bad request"})
    }

    req.session.client_id = client_id
    req.session.scope = scope
    req.session.redirect_uri = redirect_uri
    await req.session.save()
    console.log(req.session)
    res.render('login')
})

app.get('/signin', (req, res) => {
    res.render('signin')
})

app.get('/authorize_process', async (req, res) => {
    const email = req.query.email
    const password = req.query.password
    try {
        const exist = await client.get(email)

        if(exist === null) {
            res.send(JSON.stringify({state: 'error', message: 'This email or password is wrong.'}))
        } else {
            const hash = crypto.createHash("sha256").update(password).digest("hex")
            if(exist === hash) {
                const code = uuidv4()
                let redirect_uri = req.session.redirect_uri + `?code=${code}`
                console.log(redirect_uri)
                await client.set(code, JSON.stringify({email: email}))
                res.redirect(redirect_uri)
            } else {
                res.render('error',{erreur: 'This email or password is wrong.'})
            }
        }
    } catch (error) {
        console.log(error)
        res.render('error', {erreur: 'Something went wrong with signup'})
    }
})

app.get('/token', async (req, res) => {
    const code = req.query.code

    if(!code) {
        res.render('error', {erreur: "No code provided"})
    }

    const data = await client.get(code)

    if(!data) {
        res.render('error', {erreur: "This code is wrong"})
    }

    const token = jwt.sign(JSON.parse(data), "sanpellegrino")

    res.send(token)
})

app.get('/signin_process', async (req, res) => {
    const email = req.query.email
    const password = req.query.password
    const password2 = req.query.password2
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
                res.redirect('/authorize')
            } catch(error) {
                res.render('error', {erreur: 'An error occured during creation of a new user.'})
            }
        }
    } catch (error) {
        console.log(error)
        res.render('error', {erreur: 'Something went wrong with signin'})
    }

    if(result.data.state === "success") {
        req.session.user = email
        await req.session.save()
        res.redirect('/')
    } else {
        res.render('error', {erreur: result.data.message})
    }
})

app.get('/session', (req, res) => {
    res.send(req.session)
})

app.get('/sessionset', (req, res) => {
    req.session.test = "simon"
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
    console.log(`Example app listening on port ${port}`)
})