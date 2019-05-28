const request = require('request')
const cheerio = require('cheerio')
const moment = require('moment-timezone')
const { createLogger, format, transports } = require('winston')
const mongo = require('mongodb').MongoClient
var ObjectId = require('mongodb').ObjectID
require('dotenv').config()

const URL = process.env.CURRENT_URL

let db = null
let client = null
let col = null

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
    ),
    defaultMeta: { service: 'current-crawler' },
    transports: [
        new transports.File({ filename: 'error.log', level: 'error' }),
        new transports.File({ filename: 'info.log', level: 'info' })
    ]
})

if (process.env.NODE_ENV !== 'production') {
    logger.add(
        new transports.Console({
            format: format.combine(format.colorize(), format.simple())
        })
    )
}

function getData() {
    request(URL, function(err, res, body) {
        if (err) {
            logger.error(err)
            return
        }

        let $ = cheerio.load(body)

        const date = $('.js-datepicker-field')
            .val()
            .substring(0, 10)

        let continuar = true

        let element = $('.hour').first()
        let ampm = element
            .find('.hour-header')
            .text()
            .split('to')[0]
            .includes('am')
            ? 'am'
            : 'pm'
        console.log(ampm)

        while (continuar) {
            element = element.next()
            if (element.hasClass('song')) {
                procesarSong(element, date, ampm)
            } else if (element.hasClass('hour')) {
                ampm = element
                    .find('.hour-header')
                    .text()
                    .split('to')[0]
                    .includes('am')
                    ? 'am'
                    : 'pm'
            } else {
                continuar = false
            }
        }
    })
}

function procesarSong(element, date, ampm) {
    const id = element.attr('id')
    const title = element.find('h5.title').text()
    const artist = element.find('h5.artist').text()
    const time = element.find('time').text()

    let song = {}

    song.timestamp = date + ' ' + time.trim() + ' ' + ampm.toUpperCase()
    song.date = moment(song.timestamp, 'YYYY-MM-DD hh:mm A')
        .tz('America/Winnipeg')
        .toDate()
    song.id = id
    song.title = title
    song.artist = artist
    song.dateInsert = new Date()

    col.find({ timestamp: song.timestamp }).toArray((err, items) => {
        if (err) {
            logger.error(err)
        } else if (items.length == 0) {
            saveSong(song)
        }
    })
}

function saveSong(song) {
    col.insertOne(song, (err, obj) => {
        if (err) logger.error(err)
        else
            logger.info(
                `${song.dateInsert} - ${song.id} - ${song.timestamp} - ${
                    song.title
                } - ${song.artist}`
            )
    })
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
    getData()
    setInterval(() => {
        getData()
    }, process.env.SEG_FRECUENCIA * 1000)
}

main()
