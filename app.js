const exec = require('child_process').exec
const sqlite3 = require('sqlite3')

/* Edit those 2 next lines according to your library and output paths */
let photosLibraryFolder = `~/Pictures/Photos Library.photoslibrary`
let outputFolder = `~/Pictures/export`

async function shellExec(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                reject(error)
            }

            if (stderr) {
                reject(stderr)
            }

            resolve(stdout)
        })
    });
}

async function connect(dbPath) {
    return new Promise((resolve, reject) => {
        let db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, err => {
            if (err) {
                reject(err)
            }
        })

        db.on("open", () => {
            resolve(db)
        })
    })
}

async function disconnect(db) {
    return new Promise((resolve, reject) => {
        db.close(err => {
            if (err) {
                reject(err)
            }
        })

        db.on("close", () => {
            resolve()
        })        
    })
}

async function query(query, db) {
    return new Promise((resolve, reject) => {
        db.all(query, (err, res) => {
            if (err) {
                reject(err)
            }

            resolve(res)
        })
    })
}

async function main() {
    let cptr = 0
    photosLibraryFolder = photosLibraryFolder.replace(/ /g, "\\ ") // Escaping white spaces in input folder
    outputFolder = outputFolder.replace(/ /g, "\\ ") // Escaping white spaces in output folder

    // First thing : copy database to ./tmp to use an unlocked version of it
    try {
        await shellExec(`mkdir ./tmp`)
        console.log(`- Temporary folder created`)
    } catch (err) {
        console.error(`* Error creating temporary folder :`)
        console.log(err)
        process.exit(-1)
    }

    try {
        await shellExec(`cp ${photosLibraryFolder}/database/photos.db ./tmp/`)
        console.log(`- Original database copied`)
    } catch (err) {
        console.error(`* Error copying original database :`)
        console.log(err)
        process.exit(-1)
    }

    // Then open it
    let database

    try {
        database = await connect(`./tmp/photos.db`)
        console.log(`- Database opened`)
    } catch (err) {
        console.error(`* Error opening database :`)
        console.log(err)
        process.exit(-1)
    }

    // Get albums list, then iterate on each album to get photos ; then copy them
    // to destination folder.
    let albums
    try {
        albums = await query(`SELECT modelId AS albumId, name FROM RKAlbum WHERE albumSubclass = 3`, database)
        console.log(`- Albums retrieving done`)
    } catch (err) {
        console.error(`* Error retrieving albums :`)
        console.log(err)
        process.exit(-1)
    }

    for (let i = 0 ; i < albums.length ; i++) {
        let album = albums[i]
        console.log(`- Album : ` + album.name)

        let albumFolder = `${outputFolder}/${(album.name).replace(/\//, "-").replace(/ /g, "\\ ")}` // Removing / from album names, escaping white space
        try {
            await shellExec(`mkdir -p ${albumFolder}`)
            console.log(`  - Album folder created`)
        } catch (err) {
            console.error(`  * Error creating output folder :`)
            console.log(err)
            process.exit(-1)
        }

        let photos
        try {
            photos = await query(`SELECT RKMaster.fileName, RKMaster.imagePath FROM RKAlbumVersion INNER JOIN RKMaster ON (RKMaster.modelId = RKAlbumVersion.versionId) WHERE RKAlbumVersion.albumId = ${album.albumId}`, database)
            console.log(`  - Albums photos retrieved`)
        } catch (err) {
            console.error(`* Error retrieving photos :`)
            console.log(err)
            process.exit(-1)
        }

        for (let j = 0 ; j < photos.length ; j++) {
            let photo = photos[j]
            try {
                await shellExec(`cp ${photosLibraryFolder}/Masters/${photo.imagePath} ${albumFolder}/${photo.fileName}`)
                console.log(`  - Copied : ${photo.fileName}`)
                cptr++
            } catch (err) {
                console.error(`  * Error copying photo ${photo.fileName} :`)
                console.log(err)
                process.exit(-1)
            }
            
        }
    }

    try {
        database = await disconnect(database)
        console.log(`- Database closed`)
    } catch (err) {
        console.error(`* Error closing database :`)
        console.log(err)
        process.exit(-1)
    }

    try {
        await shellExec(`rm -rf ./tmp`)
        console.log(`- Temporary folder removed`)
    } catch (err) {
        console.error(`* Error removing temporary folder :`)
        console.log(err)
        process.exit(-1)
    }

    console.log(`- Exported ${cptr} photos without error`)

}

main()
