# PhotosAlbumsExporter

Export Apple Photos.app photos using albums structure

## Context

Having a 13k+ photos library, I wanted to export all of my photos keeping album structure as folders. It turned to be impossible as Photos.app crashes after exporting ~100 photos. So I made this script.

## What it does

The script simply browses a read-only copy of the Photos.app database to retrieve albums, create folders according to the albums, and copy the original photos from the photo library.

## What it doesn't do

The script doesn't keep trace of any metadata you should have set on photos, nor face recognition or things like that. It simply copies photos. If a photo appears on multiple folders, then the photo is duplicated on each folder.

## How-to

### Requirements
- git
- NodeJS LTS
- yarn

### Operations

`git clone https://github.com/MossieurPropre/PhotosAlbumExporter.git`

`cd PhotosAlbumExporter`

Edit `app.js` to match your folder configuration (Photos library folder and output folder)

`yarn install`

`yarn run`
