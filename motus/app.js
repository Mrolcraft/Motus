const express = require('express')
const fs = require('fs')
const app = express()
const path = require('path')
const os = require('os')
const axios = require('axios')
const port = process.env.PORT || 3000

app.set('view engine', 'ejs');

// Define the directory where your HTML files (views) are located
app.set('views', path.join(__dirname, 'views'));
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
    res.render('index')
})

app.get('/length', (req, res) => {
    const cache = getCache()
    res.send(JSON.stringify({length: words[cache['random_number']].length}))
})

app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
})

app.get('/score', async (req, res) => {
    const result = await axios.post("http://haproxy:3007/getscore", {"ip": req.socket.remoteAddress})
    let average = 0
    if(result.data.wordFinded !== 0) {
        average = result.data.try / result.data.wordFinded
    }
    console.log(average)
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
        await updateDB(req.socket.remoteAddress, "add_finded")
    }
    await updateDB(req.socket.remoteAddress, "add_try")
    res.send(JSON.stringify({colors: colors}))
})

app.get('/port', (req, res) => {
    res.send("MOTUS APP working " + os.hostname() + " on port " + port)
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})