const { MongoClient } = require('mongodb');

// Replace the uri string with your MongoDB deployment's connection string.
const uri = 'mongodb+srv://charitAuthor:sRQcNNmohkwluX4t@cluster0.zbwte.mongodb.net/NSTU101Bot?retryWrites=true&w=majority';

const client = new MongoClient(uri);

async function mongoConnect() {
    try {
        await client.connect();
        console.log('database connected');
    } finally {
        // await client.close();
        console.log('all ok');
    }
}

module.exports = mongoConnect;
