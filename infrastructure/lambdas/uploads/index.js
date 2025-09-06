const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const { v4: uuidv4 } = require('uuid');

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'podcastflow-pro-uploads-590183844530';
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'audio/mpeg', 'audio/mp3', 'application/pdf'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

exports.handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*'
    };
    
    try {
        const { httpMethod, body } = event;
        
        if (httpMethod === 'POST') {
            const { fileName, fileType, fileSize, campaignId } = JSON.parse(body);
            
            // Validate file type
            if (!ALLOWED_FILE_TYPES.includes(fileType)) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid file type' })
                };
            }
            
            // Validate file size
            if (fileSize > MAX_FILE_SIZE) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'File too large. Maximum size is 50MB' })
                };
            }
            
            // Generate unique key
            const fileExtension = fileName.split('.').pop();
            const key = `campaigns/${campaignId}/${uuidv4()}.${fileExtension}`;
            
            // Generate pre-signed URL
            const params = {
                Bucket: BUCKET_NAME,
                Key: key,
                Expires: 300, // 5 minutes
                ContentType: fileType,
                ACL: 'private'
            };
            
            const uploadUrl = await s3.getSignedUrlPromise('putObject', params);
            const viewUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    uploadUrl,
                    viewUrl,
                    key
                })
            };
        }
        
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};