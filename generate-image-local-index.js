const fs = require('fs');
const Promise = require('bluebird');
const mkdirp = require('mkdirp');

new Promise((resolve, reject) => {

    const pattern = '^([a-zA-Z0-9]*)-([0-9]*)-([0-9]*)-([0-9]*)-([0-9]*)\.([a-zA-Z0-9]{1,3})$';

    const resizeInfos = fs.readdirSync('./output/Paris')
        .filter(imagePath => new RegExp(pattern).test(imagePath))
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

    resolve(resizeInfos);
}).then((resizeInfos) => {
    console.log('All Done !');

    console.log('resizeInfos:', resizeInfos);

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

    const imagesDataPath = './output/Paris/images.json';
    console.log(`Writing image data to disk on path: ${imagesDataPath}`);

    fs.writeFileSync(imagesDataPath, JSON.stringify(imagesData, undefined, 2));

    process.exit(0);
})
.catch((err) => {
    console.log('Ended with error:', err);
    process.exit(1);
});
