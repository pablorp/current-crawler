const request = require('request')
const cheerio = require('cheerio')
const Datastore = require('nedb')
const moment = require('moment-timezone')

const db = new Datastore({ filename: 'songs.db', autoload: true })
const stats = {}
stats.artists = new Datastore({ filename: 'stats-artists.db', autoload: true })
stats.songs = new Datastore({ filename: 'stats-songs.db', autoload: true })

//---------------------- DB UTILS ----------------------

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

function resetDB(db) {
    return new Promise((res, rej) => {
        db.remove({}, { multi: true }, function (err, numRemoved) {
            if (err) rej(err)
            else res(numRemoved)
        });
    })
}

function find(db, filter, sort) {
    return new Promise((res, rej) => {
        db.find(filter).sort(sort).exec(function (err, docs) {
            if (err) rej(err)
            else res(docs)
        })
    })
}

function upsert(db, filter, obj) {
    return new Promise((res, rej) => {
        db.update(filter, obj, { upsert: true}, (err, num, upsert) => {
            if (err) rej(err)
            else res(upsert)
        })
    })
}

//---------------------- LOAD STATS ----------------------

async function loadSongStats() {
    await resetDB(stats.songs)
    console.log('Song stats reset')
    let songs = await find(db, {}, { date: 1 })
    console.log('Songs fetched')

    const load = async () => {
        await asyncForEach(songs, async (song) => {
            let songstats = await find(stats.songs, { id: song.id}, {})
            let n = songstats.length
            let songStat = {}
            songStat.id = song.id
            songStat.title = song.title
            songStat.artist = song.artist
            songStat.plays = n + 1
            await upsert(stats.songs, { id: songStat.id}, songStat)
            console.log('Upsert ' + songStat.id)
        })
        console.log('Song stats loaded')
    }
    
    await load()
}

async function loadArtistStats() {
    await resetDB(stats.artists)
    console.log('Artist stats reset')
    let songs = await find(db, {}, { date: 1 })
    console.log('Songs fetched')

    const load = async () => {
        await asyncForEach(songs, async (song) => {
            let artiststats = await find(stats.artists, { artist: song.artist}, {})
            let n = artiststats.length
            let stat = {}
            stat.artist = song.artist
            stat.plays = n + 1
            await upsert(stats.artists, { artist: stat.artist}, stat)
            console.log('Upsert ' + stat.artist)
        })
        console.log('Artist stats loaded')
    }
    
    await load()
}

//---------------------- OPTIONS ----------------------


function getUltimas() {
    db.find({}).sort({ date: 1 }).exec(function (err, docs) {
        docs.forEach(song => {
            console.log(`${song.timestamp} - ${song.id} - ${song.title} - ${song.artist} - ${song.dateInsert}`)
        });
    });
}

function getDuplicadas() {
    let _map = new Map()
    db.find({}).exec(function (err, docs) {
        docs.forEach(song => {
            if (_map.get(song.id)) {
                let n = _map.get(song.id)
                _map.set(song.id, n + 1)
            } else {
                _map.set(song.id, 1)
            }
        });

        for (const [key, value] of _map.entries()) {
            if (value > 1)
                console.log(key, value);
        }
    });
}

async function getTopArtists() {
    await loadArtistStats()
    console.log('Artist stats loaded 2')
    let artists = await find(stats.artists, {}, { plays: -1})
    console.log('Artist stats fetched')

    artists.forEach(artist => {
        console.log(`${artist.artist} - ${artist.plays}`)
    })
}

async function getTopSongs() {
    await loadSongStats()
    console.log('Song stats loaded 2')
    let songs = await find(stats.songs, {}, { plays: -1})
    console.log('Song stats fetched')

    console.log(songs.length)

    songs.forEach(song => {
        console.log(`${song.title} - ${song.artist} - ${song.plays}`)
    })
}

let option = process.argv[2]

if (option == 'last') {
    getUltimas()
} else if (option == 'artists') {
    getTopArtists()
} else if (option == 'songs') {
    getTopSongs()
} else if (option == 'dupes') {
    getDuplicadas()
} else {
    console.log('No option selected')
}