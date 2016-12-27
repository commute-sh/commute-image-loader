const fs = require('fs');
const Promise = require('bluebird');
const AWS = require('aws-sdk');

const profile = process.env.AWS_PROFILE;

const creds = new AWS.SharedIniFileCredentials({ profile: profile });
AWS.config.credentials = creds;


const s3Bucket = process.env.S3_BUCKET;
const contractName = process.env.CONTRACT_NAME;
const outputDir = process.env.OUTPUT_DIR;

const imagesDataPath = `${outputDir}/${contractName}/images.json`;

buildImageIndex(s3Bucket, contractName)
.then(_ => {
    console.log('All Done !');
    process.exit(0);
})
.catch(err => {
    console.log('[ERR]', err);
    process.exit(1);
});


function allS3BucketEntries(s3bucket, prefix) {

    return new Promise((resolve, reject) => {

        const s3 = new AWS.S3();

        function listAllEntries(entries, marker, cb) {
            s3.listObjects({Bucket: s3bucket, Prefix: prefix, Marker: marker}, function(err, data) {
                if (err) {
                    cb(err);
                } else {
                    entries = entries.concat(data.Contents);

                    if(data.IsTruncated) {
                        listAllEntries(entries, data.NextMarker, cb);
                    }
                    else {
                        cb(undefined, entries);
                    }
                }
            });
        }

        listAllEntries([], undefined, function(err, entries) {
            if (err) {
                reject(err);
            } else {
                resolve(entries);
            }
        });

    });
}

function buildImageIndex(bucket, prefix) {

    const pattern = '^([a-zA-Z0-9]*)-([0-9]*)-([0-9]*)-([0-9]*)-([0-9]*)\.([a-zA-Z0-9]{1,3})$';

    return allS3BucketEntries(bucket, prefix)
        .then(entries => {

            console.log('S3 found entries:', entries);

            return entries
                .filter(entry => new RegExp(pattern).test(entry.Key))
                .map(entry => entry.Key)
                .map(imagePath => {

                    console.log('Image path:', imagePath);

                    const groups = new RegExp(pattern).exec(imagePath);

                    console.log('Groups:', groups);

                    const contractName = groups[1];
                    const stationNumber = groups[2];
                    const uid = groups[3];
                    const width = groups[4];
                    const quality = groups[5];

                    return {
                        contractName: contractName,
                        station: { number: Number(stationNumber) },
                        width: Number(width),
                        quality: Number(quality),
                        uid: Number(uid)
                    };

                });

        })
        .then(resizeInfos => {
            console.log('Resize infos:', resizeInfos);

            const imagesData = resizeInfos.map(resizeInfo => {
                return {
                    contractName: resizeInfo.contractName,
                    number: resizeInfo.station.number,
                    uid: resizeInfo.uid,
                    width: resizeInfo.width,
                    height: resizeInfo.height,
                    quality: resizeInfo.quality
                };
            });

            console.log(`Writing image data to disk on path: ${imagesDataPath}`);

            fs.writeFileSync(imagesDataPath, JSON.stringify(imagesData, undefined, 2));
        });
}

