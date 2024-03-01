const express = require('express')
const fs = require('fs')
const app = express()
const path = require('path')
const os = require('os')
const axios = require('axios')
const session = require('express-session')
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
    await axios.post("http://haproxy:3007/setscore", {"ip": ip, "request": request})
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

app.get('/', (req, res) => {
    if(!req.session.user) {
        res.redirect('/signup')
    } else {
        res.render('index')
    }
})

app.get('/length', (req, res) => {
    const cache = getCache()
    res.send(JSON.stringify({length: words[cache['random_number']].length}))
})

app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
})

app.get('/score', async (req, res) => {
    try {
        const result = await axios.post("http://haproxy:3007/getscore", {"ip": req.socket.remoteAddress})
    } catch (error) {
        console.log(error)
        res.render('error', {erreur: 'Something went wrong with score'})
    }
    let average = 0
    if(result.data.wordFinded !== 0) {
        average = result.data.try / result.data.wordFinded
    }
    res.render('score', {score: average})
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
            await updateDB(req.socket.remoteAddress, "add_finded")
        } catch (error) {
            console.log(error)
        }
    }
    try {
        await updateDB(req.socket.remoteAddress, "add_try")
    } catch (error) {
        console.log(error)
    }
    res.send(JSON.stringify({colors: colors}))
})

app.get('/signup', (req, res) => {
    res.render('login')
})

app.get('/signin', (req, res) => {
    res.render('signin')
})

app.get('/signup_process', async (req, res) => {
    const email = req.query.email
    const password = req.query.password
    try {
        const result = await axios.post("http://haproxy:3010/signup", {"email": email, "password": password})
    } catch (error) {
        console.log(error)
        res.render('error', {erreur: 'Something went wrong with signup'})
    }

    if(result.data.state === "success") {
        req.session.user = email
        await req.session.save()
        res.redirect('/')
    } else {
        res.render('error', {erreur: result.data.message})
    }
})

app.get('/signin_process', async (req, res) => {
    const email = req.query.email
    const password = req.query.password
    const password2 = req.query.password2
    if(password !== password2) {
        res.render('error', {erreur: "Les mots de passes sont différents"})
    }

    try {
        const result = await axios.post("http://haproxy:3010/signin", {"email": email, "password": password})
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

app.get('/logout', async (req, res) => {
    req.session.user = null
    await req.session.save()
    res.redirect('/')
})

app.get('/port', (req, res) => {
    res.send("MOTUS APP working " + os.hostname() + " on port " + port)
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})