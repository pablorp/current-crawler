const request = require('request')
const cheerio = require('cheerio')
const moment = require('moment-timezone')
const mongo = require('mongodb').MongoClient
var ObjectId = require('mongodb').ObjectID
require('dotenv').config()

let db = null
let client = null
let col = null

//---------------------- DB UTILS ----------------------

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array)
    }
}

//---------------------- OPTIONS ----------------------

async function getUltimas(limit) {
    try {
        let items = await col
            .find({})
            .limit(limit)
            .sort({ date: -1 })
            .toArray()
        items.sort((a, b) => {
            return a.date - b.date
        })
        items.forEach(song => {
            console.log(`${song.timestamp} - ${song.title} - ${song.artist} - ${song.dateInsert}`)
        })
    } catch (error) {
        console.log(error)
    }
}

async function getTopArtists(limit) {
    let options = [{ $group: { _id: '$artist', total: { $sum: 1 } } }, { $sort: { total: -1 } }]

    try {
        let items = await col
            .aggregate(options)
            .limit(limit)
            .toArray()
        items.sort((a, b) => {
            return a.total - b.total
        })
        items.forEach(song => {
            console.log(`${song._id} - ${song.total}`)
        })
    } catch (err) {
        console.log(err)
    }
}

async function getTopSongs(limit) {
    let options = [
        { $group: { _id: { id: '$id', title: '$title', artist: '$artist' }, total: { $sum: 1 } } },
        { $sort: { total: -1 } }
    ]

    try {
        let items = await col
            .aggregate(options)
            .limit(limit)
            .toArray()
        items.sort((a, b) => {
            return a.total - b.total
        })
        items.forEach(song => {
            console.log(`${song._id.title} - ${song._id.artist} - ${song.total}`)
        })
    } catch (err) {
        console.log(err)
    }
}

async function initDB() {
    client = await mongo.connect(process.env.DATABASE_URL, {
        useNewUrlParser: true
    })
    db = client.db('current')
    col = db.collection('songs')
    console.log('Conectado a BD')
}

async function main() {
    await initDB()

    let option = process.argv[2]
    let limit = process.argv[3] ? Number(process.argv[3]) : 0

    if (option == '-l') {
        await getUltimas(limit)
    } else if (option == '-a') {
        await getTopArtists(limit)
    } else if (option == '-s') {
        await getTopSongs(limit)
    } else {
        console.log('No option selected')
    }
    client.close()
}

main()
