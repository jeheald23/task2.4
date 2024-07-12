const express = require('express');
const { S3Client, ListObjectsV2Command, PutObjectCommand, GetObjectCommand, CreateBucketCommand } = require('@aws-sdk/client-s3');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(fileUpload());

const UPLOAD_TEMP_PATH = 'uploads';
const IMAGES_BUCKET = 'my-cool-local-bucket';

const s3Client = new S3Client({
    region: 'us-east-1',
    endpoint: 'http://localhost:4566',
    forcePathStyle: true,
    credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
    },
});

const createBucketIfNotExists = async (bucketName) => {
    try {
        await s3Client.send(new ListObjectsV2Command({ Bucket: bucketName }));
    } catch (err) {
        if (err.name === 'NoSuchBucket') {
            await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
            console.log(`Bucket ${bucketName} created.`);
        }
    }
};

createBucketIfNotExists(IMAGES_BUCKET);

// List all objects in the bucket
app.get('/images', async (req, res) => {
    try {
        const listObjectsParams = {
            Bucket: IMAGES_BUCKET,
        };
        const data = await s3Client.send(new ListObjectsV2Command(listObjectsParams));
        res.send(data.Contents);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Upload an object to the bucket
app.post('/images', async (req, res) => {
    const file = req.files.image;
    const fileName = file.name;
    const tempPath = path.join(UPLOAD_TEMP_PATH, fileName);

    if (!fs.existsSync(UPLOAD_TEMP_PATH)) {
        fs.mkdirSync(UPLOAD_TEMP_PATH);
    }

    file.mv(tempPath, async (err) => {
        if (err) {
            return res.status(500).send(err);
        }

        const fileContent = fs.readFileSync(tempPath);
        const uploadParams = {
            Bucket: IMAGES_BUCKET,
            Key: fileName,
            Body: fileContent,
        };

        try {
            await s3Client.send(new PutObjectCommand(uploadParams));
            res.send('File uploaded successfully.');
        } catch (error) {
            res.status(500).send(error);
        } finally {
            fs.unlinkSync(tempPath); // remove the file after upload
        }
    });
});

// Retrieve an object from the bucket
app.get('/images/:key', async (req, res) => {
    const params = {
        Bucket: IMAGES_BUCKET,
        Key: req.params.key,
    };

    try {
        const data = await s3Client.send(new GetObjectCommand(params));
        data.Body.pipe(res);
    } catch (error) {
        res.status(500).send(error);
    }
});

const port = 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
