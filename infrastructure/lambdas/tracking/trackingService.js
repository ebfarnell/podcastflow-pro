const AWS = require('aws-sdk');
const UPSTracker = require('./carriers/ups');
const FedExTracker = require('./carriers/fedex');
const USPSTracker = require('./carriers/usps');
const DHLTracker = require('./carriers/dhl');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const secretsManager = new AWS.SecretsManager();

class TrackingService {
    constructor() {
        this.tableName = process.env.DYNAMODB_TABLE_NAME;
        this.secretName = process.env.CARRIER_SECRETS_NAME || 'podcastflow-carrier-credentials';
        this.trackers = {};
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Load carrier credentials from AWS Secrets Manager
            const secretResponse = await secretsManager.getSecretValue({
                SecretId: this.secretName
            }).promise();

            const credentials = JSON.parse(secretResponse.SecretString);

            // Initialize carrier trackers
            if (credentials.ups) {
                this.trackers.UPS = new UPSTracker({
                    clientId: credentials.ups.client_id,
                    clientSecret: credentials.ups.client_secret,
                    sandbox: credentials.ups.sandbox || false
                });
            }

            if (credentials.fedex) {
                this.trackers.FedEx = new FedExTracker({
                    apiKey: credentials.fedex.api_key,
                    secretKey: credentials.fedex.secret_key,
                    sandbox: credentials.fedex.sandbox || false
                });
            }

            if (credentials.usps) {
                this.trackers.USPS = new USPSTracker({
                    username: credentials.usps.username,
                    password: credentials.usps.password,
                    sandbox: credentials.usps.sandbox || false
                });
            }

            if (credentials.dhl) {
                this.trackers.DHL = new DHLTracker({
                    apiKey: credentials.dhl.api_key,
                    sandbox: credentials.dhl.sandbox || false
                });
            }

            this.initialized = true;
            console.log('Tracking service initialized with carriers:', Object.keys(this.trackers));
        } catch (error) {
            console.error('Failed to initialize tracking service:', error);
            throw error;
        }
    }

    async createShipment(campaignId, shipmentData) {
        await this.initialize();

        const shipmentId = require('uuid').v4();
        const timestamp = new Date().toISOString();

        const shipment = {
            PK: `SHIPMENT#${shipmentId}`,
            SK: 'METADATA',
            GSI1PK: `CAMPAIGN#${campaignId}`,
            GSI1SK: `SHIPMENT#${shipmentData.status}#${timestamp}`,
            GSI2PK: 'TRACKING_ACTIVE',
            GSI2SK: `${shipmentData.carrier}#${timestamp}`,
            
            // Shipment data
            id: shipmentId,
            campaignId,
            productName: shipmentData.productName,
            carrier: shipmentData.carrier,
            trackingNumber: shipmentData.trackingNumber,
            recipientName: shipmentData.recipientName,
            recipientAddress: shipmentData.recipientAddress,
            shippedDate: shipmentData.shippedDate,
            estimatedDelivery: shipmentData.estimatedDelivery,
            actualDelivery: shipmentData.actualDelivery,
            status: shipmentData.status,
            notes: shipmentData.notes,
            
            // Tracking metadata
            trackingData: null,
            lastTracked: null,
            trackingAttempts: 0,
            
            // Audit fields
            createdAt: timestamp,
            updatedAt: timestamp
        };

        try {
            await dynamodb.put({
                TableName: this.tableName,
                Item: shipment
            }).promise();

            // Immediately attempt to get tracking data
            if (this.trackers[shipmentData.carrier]) {
                try {
                    const trackingData = await this.updateShipmentTracking(shipmentId);
                    shipment.trackingData = trackingData;
                } catch (error) {
                    console.warn(`Initial tracking failed for ${shipmentId}:`, error.message);
                }
            }

            return shipment;
        } catch (error) {
            console.error('Failed to create shipment:', error);
            throw error;
        }
    }

    async updateShipmentTracking(shipmentId) {
        await this.initialize();

        try {
            // Get shipment data
            const result = await dynamodb.get({
                TableName: this.tableName,
                Key: {
                    PK: `SHIPMENT#${shipmentId}`,
                    SK: 'METADATA'
                }
            }).promise();

            if (!result.Item) {
                throw new Error('Shipment not found');
            }

            const shipment = result.Item;
            const tracker = this.trackers[shipment.carrier];

            if (!tracker) {
                throw new Error(`Tracker not available for carrier: ${shipment.carrier}`);
            }

            // Track the package
            const trackingData = await tracker.trackPackage(shipment.trackingNumber);
            const timestamp = new Date().toISOString();

            // Determine if status changed
            const statusChanged = shipment.status !== trackingData.status;

            // Update shipment with tracking data
            const updateExpression = `
                SET trackingData = :trackingData,
                    lastTracked = :timestamp,
                    trackingAttempts = trackingAttempts + :inc,
                    updatedAt = :timestamp,
                    #status = :status,
                    estimatedDelivery = :estimatedDelivery,
                    actualDelivery = :actualDelivery
            `;

            const updateValues = {
                ':trackingData': trackingData,
                ':timestamp': timestamp,
                ':inc': 1,
                ':status': trackingData.status,
                ':estimatedDelivery': trackingData.estimatedDelivery || shipment.estimatedDelivery,
                ':actualDelivery': trackingData.actualDelivery || shipment.actualDelivery
            };

            // Update GSI1SK if status changed
            if (statusChanged) {
                updateExpression += ', GSI1SK = :gsi1sk';
                updateValues[':gsi1sk'] = `SHIPMENT#${trackingData.status}#${timestamp}`;
            }

            await dynamodb.update({
                TableName: this.tableName,
                Key: {
                    PK: `SHIPMENT#${shipmentId}`,
                    SK: 'METADATA'
                },
                UpdateExpression: updateExpression,
                ExpressionAttributeNames: {
                    '#status': 'status'
                },
                ExpressionAttributeValues: updateValues
            }).promise();

            // If status changed to delivered, remove from active tracking
            if (trackingData.status === 'delivered' || trackingData.status === 'failed') {
                await dynamodb.update({
                    TableName: this.tableName,
                    Key: {
                        PK: `SHIPMENT#${shipmentId}`,
                        SK: 'METADATA'
                    },
                    UpdateExpression: 'REMOVE GSI2PK, GSI2SK'
                }).promise();
            }

            console.log(`Updated tracking for shipment ${shipmentId}: ${shipment.status} -> ${trackingData.status}`);
            return trackingData;

        } catch (error) {
            console.error(`Failed to update tracking for shipment ${shipmentId}:`, error);
            
            // Update tracking attempt count even on failure
            await dynamodb.update({
                TableName: this.tableName,
                Key: {
                    PK: `SHIPMENT#${shipmentId}`,
                    SK: 'METADATA'
                },
                UpdateExpression: 'SET trackingAttempts = trackingAttempts + :inc, lastTracked = :timestamp',
                ExpressionAttributeValues: {
                    ':inc': 1,
                    ':timestamp': new Date().toISOString()
                }
            }).promise().catch(console.error);

            throw error;
        }
    }

    async getShipmentsByStatus(status, limit = 100) {
        try {
            const result = await dynamodb.query({
                TableName: this.tableName,
                IndexName: 'GSI2',
                KeyConditionExpression: 'GSI2PK = :pk',
                ExpressionAttributeValues: {
                    ':pk': 'TRACKING_ACTIVE'
                },
                Limit: limit
            }).promise();

            return result.Items || [];
        } catch (error) {
            console.error('Failed to get shipments by status:', error);
            throw error;
        }
    }

    async getCampaignShipments(campaignId) {
        try {
            const result = await dynamodb.query({
                TableName: this.tableName,
                IndexName: 'GSI1',
                KeyConditionExpression: 'GSI1PK = :pk',
                FilterExpression: 'begins_with(PK, :shipmentPrefix)',
                ExpressionAttributeValues: {
                    ':pk': `CAMPAIGN#${campaignId}`,
                    ':shipmentPrefix': 'SHIPMENT#'
                }
            }).promise();

            return result.Items || [];
        } catch (error) {
            console.error('Failed to get campaign shipments:', error);
            throw error;
        }
    }

    async updateShipmentStatus(shipmentId, status, notes = '') {
        const timestamp = new Date().toISOString();

        try {
            const updateExpression = `
                SET #status = :status,
                    updatedAt = :timestamp,
                    GSI1SK = :gsi1sk,
                    notes = :notes
            `;

            const updateValues = {
                ':status': status,
                ':timestamp': timestamp,
                ':gsi1sk': `SHIPMENT#${status}#${timestamp}`,
                ':notes': notes
            };

            // Remove from active tracking if delivered or failed
            if (status === 'delivered' || status === 'failed') {
                updateExpression += ' REMOVE GSI2PK, GSI2SK';
            }

            await dynamodb.update({
                TableName: this.tableName,
                Key: {
                    PK: `SHIPMENT#${shipmentId}`,
                    SK: 'METADATA'
                },
                UpdateExpression: updateExpression,
                ExpressionAttributeNames: {
                    '#status': 'status'
                },
                ExpressionAttributeValues: updateValues
            }).promise();

            console.log(`Manually updated shipment ${shipmentId} status to ${status}`);
            return true;
        } catch (error) {
            console.error('Failed to update shipment status:', error);
            throw error;
        }
    }

    async batchUpdateTracking(shipmentIds) {
        await this.initialize();

        const results = [];
        const carriers = {};

        // Group shipments by carrier for batch processing
        for (const shipmentId of shipmentIds) {
            try {
                const result = await dynamodb.get({
                    TableName: this.tableName,
                    Key: {
                        PK: `SHIPMENT#${shipmentId}`,
                        SK: 'METADATA'
                    }
                }).promise();

                if (result.Item) {
                    const carrier = result.Item.carrier;
                    if (!carriers[carrier]) {
                        carriers[carrier] = [];
                    }
                    carriers[carrier].push({
                        shipmentId,
                        trackingNumber: result.Item.trackingNumber,
                        shipment: result.Item
                    });
                }
            } catch (error) {
                results.push({
                    shipmentId,
                    error: error.message,
                    success: false
                });
            }
        }

        // Process each carrier's shipments
        for (const [carrierName, shipmentData] of Object.entries(carriers)) {
            const tracker = this.trackers[carrierName];
            if (!tracker) {
                shipmentData.forEach(({ shipmentId }) => {
                    results.push({
                        shipmentId,
                        error: `Tracker not available for carrier: ${carrierName}`,
                        success: false
                    });
                });
                continue;
            }

            try {
                const trackingNumbers = shipmentData.map(s => s.trackingNumber);
                const trackingResults = await tracker.batchTrack(trackingNumbers);

                // Update each shipment with its tracking result
                for (let i = 0; i < trackingResults.length; i++) {
                    const trackingResult = trackingResults[i];
                    const { shipmentId, shipment } = shipmentData[i];

                    try {
                        if (trackingResult.error) {
                            throw new Error(trackingResult.error);
                        }

                        const timestamp = new Date().toISOString();
                        const statusChanged = shipment.status !== trackingResult.status;

                        const updateExpression = `
                            SET trackingData = :trackingData,
                                lastTracked = :timestamp,
                                trackingAttempts = trackingAttempts + :inc,
                                updatedAt = :timestamp,
                                #status = :status,
                                estimatedDelivery = :estimatedDelivery,
                                actualDelivery = :actualDelivery
                        `;

                        const updateValues = {
                            ':trackingData': trackingResult,
                            ':timestamp': timestamp,
                            ':inc': 1,
                            ':status': trackingResult.status,
                            ':estimatedDelivery': trackingResult.estimatedDelivery || shipment.estimatedDelivery,
                            ':actualDelivery': trackingResult.actualDelivery || shipment.actualDelivery
                        };

                        if (statusChanged) {
                            updateExpression += ', GSI1SK = :gsi1sk';
                            updateValues[':gsi1sk'] = `SHIPMENT#${trackingResult.status}#${timestamp}`;
                        }

                        await dynamodb.update({
                            TableName: this.tableName,
                            Key: {
                                PK: `SHIPMENT#${shipmentId}`,
                                SK: 'METADATA'
                            },
                            UpdateExpression: updateExpression,
                            ExpressionAttributeNames: {
                                '#status': 'status'
                            },
                            ExpressionAttributeValues: updateValues
                        }).promise();

                        results.push({
                            shipmentId,
                            trackingData: trackingResult,
                            success: true
                        });

                    } catch (error) {
                        results.push({
                            shipmentId,
                            error: error.message,
                            success: false
                        });
                    }
                }

            } catch (error) {
                shipmentData.forEach(({ shipmentId }) => {
                    results.push({
                        shipmentId,
                        error: error.message,
                        success: false
                    });
                });
            }
        }

        return results;
    }
}

module.exports = TrackingService;