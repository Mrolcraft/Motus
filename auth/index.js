const express = require('express')
const session = require('express-session')
const bodyParser = require('body-parser')
const path = require('path')
const axios = require('axios')
const redis = require('redis')
const app = express()

port = process.env.PORT || 5002
var hour = 3600000

const client = redis.createClient({url: "redis://redis2:6379"})

app.set('view engine', 'ejs');

app.set('views', path.join(__dirname, 'views'));

// Parse URL-encoded bodies (as sent by HTML forms)
app.use(bodyParser.urlencoded({ extended: true }));

// Parse JSON bodies (as sent by API clients)
app.use(bodyParser.json());

app.use(session({
    name: 'albert',
    keys:['robert','george'],
    secret: 'team dogs',
    cookie:{
        secure: true,
        httpOnly: true,
        maxAge: hour
    }
}))

app.get('/login',(req,res) => {
    res.render('login')
})

app.get('/register', (req,res) => {
    res.render('register')
})

app.get("/session",(req,res) => {
    app.use((req,res,next)=>{
        if(req.session.user){
          next()
        }else{
          res.redirect("/login")
        }
    })
    res.send(JSON.stringify(req.session))
})

app.post("/tryConnect", async (req,res) => {
    const login = req.body.login
    const password = req.body.password
    console.log(login)
    console.log(password)
    let value = await client.get(login)
    //let value = ""  
    if (password === value){
        //connecté!
    }
    else{
        console.log("connexion échouée...")
    }
    res.send("ça a marché?")
})

app.post("/newUser", async(req,res)=>{
    const login = req.body.login
    const password = req.body.password
    let exists=client.get(login)
    if(exists === null){
        await client.set(login, bodyParser.json({"password":password}))
    }
    else{
        res.send("User déjà existant!")
    }
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})