const gm = require('gm');
const fs = require('fs');
const Promise = require('bluebird');
const mkdirp = require('mkdirp');
const request = require('request');
const GeoPoint = require('geopoint');
const _ = require('lodash');

mkdirp.sync('./output');

const ExifImage = require('exif').ExifImage;

const im = gm.subClass({ imageMagick: true });

const input = 'input-20161226-1';
const contractName = 'Paris';
const dimensions = { width: 640, height: 480 }
const quality = 60;

request({ url: `http://api.commute.sh/stations?contract-name=${contractName}`, json: true }, (err, response, stations) => {

    if (err) {
        console.log('[ERR]', err.message);
        process.exit(1);
    }

    if (response.statusCode >= 300) {
        console.log('[ERR] Status code:', response.statusCode);
        process.exit(1);
    }

    stations.forEach(station => {
        station.geoLocation = new GeoPoint(station.position.lat, station.position.lng);
    });

    const images = fs.readdirSync(`./${input}`)
        .filter((image, i) => image !== '.DS_Store'); // Quickfix to avoid issue with .DS_Store

    Promise.map(images, (image) => {
        return resize(image, quality, dimensions, stations);
    }, { concurrency: 8 })
        .then((resizeInfos) => {
            console.log('All Done !');

            console.log('resizeInfos:', resizeInfos);

            process.exit(0);
        })
        .catch((err) => {
            console.log('Ended with error:', err);
            process.exit(1);
        });

    setTimeout(() => {
        console.log("Resizing Timeouted");
        process.exit(2);
    }, 300000);


});


function ParseDMS(parts) {
    return ConvertDMSToDD(parts[0], parts[1], parts[2], parts[3]);
}

function ConvertDMSToDD(degrees, minutes, seconds, direction) {
    let dd = degrees + minutes/60 + seconds/(60 * 60);
    if (direction == "S" || direction == "W") {
        dd = dd * -1;
    } // Don't do anything for N or E
    return dd;
}

uids = {};

function resize(image, quality, size, stations) {

    return new Promise((resolve, reject) => {

        const imagePath = `./${input}/${image}`;

        try {
            new ExifImage({ image : imagePath }, function (err, exifData) {

                if (err) {
                    console.log('[ERR]', image, ':', err.message);
                    reject(err);
                    return ;
                }

                const geoLocation = new GeoPoint(
                    exifData.gps.GPSLatitude ? ParseDMS(exifData.gps.GPSLatitude) : 0,
                    exifData.gps.GPSLongitude ? ParseDMS(exifData.gps.GPSLongitude) : 0
                );

                console.log('[Exif][GPS]', image, ':', geoLocation);

                const nearestStation = _.sortBy(stations, (station) => station.geoLocation.distanceTo(geoLocation, true))[0];

                im(imagePath).identify((err, data) => {

                    if (err) {
                        console.log('[ERR]', image, ':', err.message);
                        reject(err);
                        return ;
                    }

                    console.log('[Identify]', image, ':', data.size);

                    const uid = nearestStation.contract_name + '-' + nearestStation.number + '-' + (size ? size.width : 'full') + '-' + quality + '.jpg';
                    uids[uid] = (uids[uid] || 0) + 1;

                    const outName = nearestStation.contract_name + '-' + nearestStation.number + '-' + uids[uid] + '-' + (size ? size.width : 'full') + '-' + quality + '.jpg';

                    const width = size ? size.width : data.size.width;
                    const height = size ? size.height : data.size.height;
                    const outPath = `./output/${outName}`;

                    im(imagePath).thumb(width, height, outPath, quality, (err, data) => {
                        if (err) {
                            console.log('[ERR]', image, ':', err.message);
                            reject(err);
                            return ;
                        }

                        console.log('[OK]', image, "=>", outName);

                        resolve({
                            station: nearestStation,
                            width: width,
                            height: height,
                            quality: quality,
                            uid: uids[uid],
                            data
                        });
                    });
                });

            });
        } catch (error) {
            console.log('Error: ' + error.message);
        }

    });
}
