const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, MongoRuntimeError } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ztdah.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

//Jwt

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
      if (err) {
        return res.status(403).send({ message: 'Forbidden access' })
      }
      req.decoded = decoded;
      next();
    });
  }
  
  
  async function run() {
    try {
      await client.connect();
      const serviceCollection = client.db('Manufacture').collection('services');
      const cartCollection = client.db('Manufacture').collection('carts');
      const userCollection = client.db('Manufacture').collection('users');
  
      // service
      app.get('/service', async (req, res) => {
        const query = {};
        const cursor = serviceCollection.find(query);
        const services = await cursor.toArray();
        res.send(services);
      });
  
      // User
      app.get('/user', verifyJWT, async (req, res) => {
        const users = await userCollection.find().toArray();
        res.send(users);
      });
  
      // admin email
      app.get('/admin/:email', async(req, res) =>{
        const email = req.params.email;
        const user = await userCollection.findOne({email: email});
        const isAdmin = user.role === 'admin';
        res.send({admin: isAdmin})
      })
  
      app.put('/user/admin/:email', verifyJWT, async (req, res) => {
        const email = req.params.email;
        const requester = req.decoded.email;
        const requesterAccount = await userCollection.findOne({ email: requester });
        if (requesterAccount.role === 'admin') {
          const filter = { email: email };
          const updateDoc = {
            $set: { role: 'admin' },
          };
          const result = await userCollection.updateOne(filter, updateDoc);
          res.send(result);
        }
        else{
          res.status(403).send({message: 'forbidden'});
        }
  
      })
  
      app.put('/user/:email', async (req, res) => {
        const email = req.params.email;
        const user = req.body;
        const filter = { email: email };
        const options = { upsert: true };
        const updateDoc = {
          $set: user,
        };
        const result = await userCollection.updateOne(filter, updateDoc, options);
        const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
        res.send({ result, token });
      })
  

      // available 
      app.get('/available', async (req, res) => {
        const date = req.query.date;
          const services = await serviceCollection.find().toArray();
          const query = { date: date };
        const carts = await cartCollection.find(query).toArray();
  
        services.forEach(service => {
          const servicecarts = carts.filter(book => book.treatment === service.name);
          const bookedSlots = servicecarts.map(book => book.slot);
          const available = service.slots.filter(slot => !bookedSlots.includes(slot));
          service.slots = available;
        });
  
  
        res.send(services);
      })

      app.get('/cart', verifyJWT, async (req, res) => {
        const patient = req.query.patient;
        const decodedEmail = req.decoded.email;
        if (patient === decodedEmail) {
          const query = { patient: patient };
          const carts = await cartCollection.find(query).toArray();
          return res.send(carts);
        }
        else {
          return res.status(403).send({ message: 'forbidden access' });
        }
      })
  
      app.post('/cart', async (req, res) => {
        const cart = req.body;
        const query = { treatment: cart.treatment, date: cart.date, patient: cart.patient }
        const exists = await cartCollection.findOne(query);
        if (exists) {
          return res.send({ success: false, cart: exists })
        }
        const result = await cartCollection.insertOne(cart);
        return res.send({ success: true, result });
      })
  
    }
    finally {
  
    }
  }
  
  run().catch(console.dir);
  
  

app.get('/', (req, res) => {
    res.send('Hello from backend')
});

app.listen(port, () => {
    console.log('My backend server is running on port', port);
})

