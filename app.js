const exec = require('child_process').exec
const sqlite3 = require('sqlite3')
const fs = require('fs')

/* Edit those 2 next lines according to your library and output paths */
let photosLibraryFolder = `~/Pictures/Photos Library.photoslibrary`
let outputFolder = `~/Pictures/export`

let errors = []

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

function sanitize(str) {
    return str.replace(/\s/g, "\\ ").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/'/g, "\\'").replace(/"/g, "\\\"")
}

async function main() {
    let cptr = 0
    photosLibraryFolder = sanitize(photosLibraryFolder) // Escaping white spaces in input folder
    outputFolder = sanitize(outputFolder) // Escaping white spaces in output folder

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

        let albumFolder = `${outputFolder}/${sanitize(album.name).replace(/\//g, "-")}` // Removing / from album names, escaping white space
        try {
            await shellExec(`mkdir -p ${albumFolder}`)
            console.log(`  - Album folder created`)
        } catch (err) {
            console.error(`  * Error creating output folder`)
            let error = {
                process: "Output folder creation",
                object: albumFolder,
                rawError: err
            }
            errors.push(error)
            continue
        }

        let photos
        try {
            photos = await query(`SELECT RKMaster.fileName, RKMaster.imagePath FROM RKAlbumVersion INNER JOIN RKVersion ON (RKVersion.modelId = RKAlbumVersion.versionId) INNER JOIN RKMaster ON (RKMaster.uuid = RKVersion.masterUuid) WHERE RKAlbumVersion.albumId = ${album.albumId} AND RKMaster.filename IS NOT NULL`, database)
            console.log(`  - Albums photos retrieved`)
        } catch (err) {
            console.error(`* Error retrieving photos :`)
            console.log(err)
            process.exit(-1)
        }

        for (let j = 0 ; j < photos.length ; j++) {
            let photo = photos[j]
            let imagePath = sanitize(photo.imagePath)
            let fileName = sanitize(photo.fileName)
            try {
                await shellExec(`cp ${photosLibraryFolder}/Masters/${imagePath} ${albumFolder}/${fileName}`)
                console.log(`  - Copied : ${photo.fileName}`)
                cptr++
            } catch (err) {
                console.error(`  * Error copying photo ${photo.fileName}`)
                let error = {
                    process: "Photo copying",
                    object: photo.fileName,
                    rawError: err
                }
                errors.push(error)
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

    console.log(`- Exported ${cptr} photos with ${(errors.length > 0) ? errors.length : "no"} error${(errors.length > 1) ? "s" : ""}`)
    if (errors.length > 0) {
        console.log("You can check for errors in errors.log")
        fs.writeFileSync('errors.log', JSON.stringify(errors, null, 4))
    }

}

main()
