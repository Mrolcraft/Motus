const express = require('express')
const fs = require('fs')
const app = express()
const path = require('path')
const os = require('os')
const axios = require('axios')
const session = require('express-session')
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 3000

app.set('view engine', 'ejs');

// Define the directory where your HTML files (views) are located
app.set('views', path.join(__dirname, 'views'));

app.set('trust proxy', 1) // trust first proxy
app.use(session({
    secret: 'CY-Tech top 10 écoles post-bac',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}))

const words = fs.readFileSync('./data/liste_francais_utf8.txt').toString().split("\n");

function padTo2Digits(num) {
    return num.toString().padStart(2, '0');
}

async function updateDB(ip, request) {
    await axios.post("http://haproxy:3007/setscore", {"email": ip, "request": request})
}

function formatDate(date) {
    return [
        date.getFullYear(),
        padTo2Digits(date.getMonth() + 1),
        padTo2Digits(date.getDate()),
    ].join('-');
}

function getCache() {
    const cache = JSON.parse(fs.readFileSync('./cache.json'))
    const today = new Date();
    if (cache['date'] !== formatDate(today)) {
        today.setHours(0,0,0,0)
        cache['date'] = formatDate(today)
        cache['random_number'] = Math.floor(Math.random() * words.length)
        fs.writeFileSync('./cache.json', JSON.stringify(cache))
    } else if(cache['random_number'] === -1) {
        cache['random_number'] = Math.floor(Math.random() * words.length)
        fs.writeFileSync('./cache.json', JSON.stringify(cache))
    }
    return cache
}

app.get('/', async (req, res) => {
    if(!req.session.code) {
        res.redirect(`http://localhost:3010/authorize?client_id=motus_app&scope=openid.play&redirect_uri=${encodeURIComponent("http://localhost:3101/callback")}`)
    } else {
        const result = await axios.get(`http://haproxy:3010/token?code=${req.session.code}`)
        const id_token = result.data
        const decoded = jwt.verify(id_token, "sanpellegrino")
        req.session.email = decoded.email
        await req.session.save()
        res.render('index', {email: decoded.email})
    }
})

app.get('/length', (req, res) => {
    const cache = getCache()
    res.send(JSON.stringify({length: words[cache['random_number']].length}))
})

app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
})

app.get('/callback', async (req, res) => {
    req.session.code = req.query.code
    await req.session.save()
    res.redirect('/')
})

app.get('/logout', async (req, res) => {
    req.session.code = null
    req.session.email = null
    await req.session.save()
    res.redirect('/')
})

app.get('/score', async (req, res) => {
    try {
        console.log(req.session.email)
        const result = await axios.post("http://haproxy:3007/getscore", {"email": req.session.email})
        let average = 0
        if(result.data.wordFinded !== 0) {
            average = result.data.try / result.data.wordFinded
        }
        res.render('score', {score: average})
    } catch (error) {
        console.log(error)
        res.render('error', {erreur: 'Something went wrong with score'})
    }
})

app.get('/word' , async (req, res) => {
    const cache = getCache()

    const word_to_find = words[cache['random_number']].toLowerCase()
    const word_found = req.query.word.toLowerCase()
    console.log(word_to_find)
    colors = []
    letter_found = []
    let finded = true
    for (let i = 0; i < word_found.length; i++) {
        if (word_found[i] === word_to_find[i]) {
            colors.push('green')
        } else if (word_to_find.includes(word_found[i])) {
            if (letter_found.includes(word_found[i])) {
                colors.push('none')
                finded = false
            } else {
                colors.push('orange')
                letter_found.push(word_found[i])
                finded = false
            }
        } else {
            colors.push('none')
            finded = false
        }
    }
    if(finded) {
        try {
            await updateDB(req.session.email, "add_finded")
        } catch (error) {
            console.log(error)
        }
    }
    try {
        await updateDB(req.session.email, "add_try")
    } catch (error) {
        console.log(error)
    }
    res.send(JSON.stringify({colors: colors}))
})

app.get('/port', (req, res) => {
    res.send("MOTUS APP working " + os.hostname() + " on port " + port)
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})