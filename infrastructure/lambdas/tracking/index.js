const TrackingService = require('./trackingService');

const trackingService = new TrackingService();

exports.handler = async (event) => {
    const { httpMethod, pathParameters, body, queryStringParameters } = event;
    
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    };

    try {
        // Handle CORS preflight
        if (httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers,
                body: ''
            };
        }

        const path = event.resource || event.routeKey;
        
        switch (true) {
            // Create shipment for campaign
            case httpMethod === 'POST' && path.includes('/campaigns/{campaignId}/shipments'):
                return await createShipment(pathParameters.campaignId, JSON.parse(body), headers);
            
            // Get shipments for campaign
            case httpMethod === 'GET' && path.includes('/campaigns/{campaignId}/shipments'):
                return await getCampaignShipments(pathParameters.campaignId, headers);
            
            // Update shipment tracking
            case httpMethod === 'POST' && path.includes('/shipments/{shipmentId}/track'):
                return await updateShipmentTracking(pathParameters.shipmentId, headers);
            
            // Update shipment status manually
            case httpMethod === 'PUT' && path.includes('/shipments/{shipmentId}/status'):
                return await updateShipmentStatus(pathParameters.shipmentId, JSON.parse(body), headers);
            
            // Get active shipments for tracking
            case httpMethod === 'GET' && path.includes('/shipments/active'):
                return await getActiveShipments(queryStringParameters, headers);
            
            // Batch update tracking for multiple shipments
            case httpMethod === 'POST' && path.includes('/shipments/batch-track'):
                return await batchUpdateTracking(JSON.parse(body), headers);
            
            // Webhook endpoint for carrier notifications
            case httpMethod === 'POST' && path.includes('/webhooks/tracking'):
                return await handleTrackingWebhook(body, event.headers, headers);
            
            default:
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'Endpoint not found' })
                };
        }
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
            })
        };
    }
};

async function createShipment(campaignId, shipmentData, headers) {
    try {
        // Validate required fields
        const required = ['productName', 'carrier', 'trackingNumber', 'recipientName'];
        for (const field of required) {
            if (!shipmentData[field]) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: `Missing required field: ${field}` })
                };
            }
        }

        // Validate carrier
        const validCarriers = ['UPS', 'FedEx', 'USPS', 'DHL', 'Other'];
        if (!validCarriers.includes(shipmentData.carrier)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid carrier' })
            };
        }

        const shipment = await trackingService.createShipment(campaignId, shipmentData);
        
        return {
            statusCode: 201,
            headers,
            body: JSON.stringify(shipment)
        };
    } catch (error) {
        console.error('Create shipment error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

async function getCampaignShipments(campaignId, headers) {
    try {
        const shipments = await trackingService.getCampaignShipments(campaignId);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ shipments })
        };
    } catch (error) {
        console.error('Get campaign shipments error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

async function updateShipmentTracking(shipmentId, headers) {
    try {
        const trackingData = await trackingService.updateShipmentTracking(shipmentId);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                shipmentId,
                trackingData,
                updated: true
            })
        };
    } catch (error) {
        console.error('Update shipment tracking error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

async function updateShipmentStatus(shipmentId, statusData, headers) {
    try {
        const { status, notes = '' } = statusData;
        
        if (!status) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Status is required' })
            };
        }

        const validStatuses = ['shipped', 'in_transit', 'delivered', 'failed', 'returned'];
        if (!validStatuses.includes(status)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid status' })
            };
        }

        await trackingService.updateShipmentStatus(shipmentId, status, notes);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                shipmentId,
                status,
                updated: true
            })
        };
    } catch (error) {
        console.error('Update shipment status error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

async function getActiveShipments(queryParams, headers) {
    try {
        const limit = queryParams?.limit ? parseInt(queryParams.limit) : 100;
        const shipments = await trackingService.getShipmentsByStatus('active', limit);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ shipments })
        };
    } catch (error) {
        console.error('Get active shipments error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

async function batchUpdateTracking(requestData, headers) {
    try {
        const { shipmentIds } = requestData;
        
        if (!shipmentIds || !Array.isArray(shipmentIds)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'shipmentIds array is required' })
            };
        }

        const results = await trackingService.batchUpdateTracking(shipmentIds);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                totalProcessed: results.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                results
            })
        };
    } catch (error) {
        console.error('Batch update tracking error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

async function handleTrackingWebhook(body, eventHeaders, headers) {
    try {
        // Parse webhook data based on carrier
        const carrier = eventHeaders['X-Carrier'] || eventHeaders['x-carrier'];
        
        if (!carrier) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Carrier header required' })
            };
        }

        // Parse webhook payload
        let webhookData;
        try {
            webhookData = typeof body === 'string' ? JSON.parse(body) : body;
        } catch (error) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid JSON payload' })
            };
        }

        // Process webhook based on carrier
        switch (carrier.toLowerCase()) {
            case 'ups':
                await processUPSWebhook(webhookData);
                break;
            case 'fedex':
                await processFedExWebhook(webhookData);
                break;
            case 'usps':
                await processUSPSWebhook(webhookData);
                break;
            case 'dhl':
                await processDHLWebhook(webhookData);
                break;
            default:
                console.warn('Unknown carrier webhook:', carrier);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ received: true })
        };
    } catch (error) {
        console.error('Webhook processing error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

async function processUPSWebhook(data) {
    // UPS webhook processing logic
    console.log('Processing UPS webhook:', data);
    // Implementation would depend on UPS webhook format
}

async function processFedExWebhook(data) {
    // FedEx webhook processing logic
    console.log('Processing FedEx webhook:', data);
    // Implementation would depend on FedEx webhook format
}

async function processUSPSWebhook(data) {
    // USPS webhook processing logic
    console.log('Processing USPS webhook:', data);
    // Implementation would depend on USPS webhook format
}

async function processDHLWebhook(data) {
    // DHL webhook processing logic
    console.log('Processing DHL webhook:', data);
    // Implementation would depend on DHL webhook format
}