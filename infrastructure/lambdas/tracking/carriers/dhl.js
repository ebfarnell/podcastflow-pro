const axios = require('axios');

class DHLTracker {
    constructor(config) {
        this.config = config;
        this.baseURL = config.sandbox ? 
            'https://api-sandbox.dhl.com' : 
            'https://api-eu.dhl.com';
    }

    async trackPackage(trackingNumber) {
        try {
            const response = await axios.get(
                `${this.baseURL}/track/shipments`,
                {
                    headers: {
                        'DHL-API-Key': this.config.apiKey,
                        'Content-Type': 'application/json'
                    },
                    params: {
                        trackingNumber: trackingNumber,
                        service: 'express',
                        requesterCountryCode: 'US',
                        originCountryCode: 'US'
                    }
                }
            );

            const shipments = response.data.shipments;
            if (!shipments || shipments.length === 0) {
                throw new Error('No tracking data found');
            }

            return this.parseDHLResponse(shipments[0]);
        } catch (error) {
            console.error('DHL tracking failed:', error.response?.data || error.message);
            if (error.response?.status === 404) {
                return {
                    status: 'not_found',
                    message: 'Tracking number not found',
                    trackingNumber
                };
            }
            throw error;
        }
    }

    parseDHLResponse(shipment) {
        const events = shipment.events || [];
        const latestEvent = events[0];
        
        let status = 'unknown';
        let statusDetails = '';
        let estimatedDelivery = null;
        let actualDelivery = null;
        
        if (latestEvent) {
            const statusCode = latestEvent.statusCode;
            statusDetails = latestEvent.description;
            
            switch (statusCode) {
                case 'delivered':
                case 'DD':
                    status = 'delivered';
                    actualDelivery = latestEvent.timestamp;
                    break;
                case 'transit':
                case 'PU':
                case 'AR':
                case 'DP':
                    status = 'in_transit';
                    break;
                case 'pre-transit':
                case 'PL':
                    status = 'shipped';
                    break;
                case 'failure':
                case 'UN':
                case 'EX':
                    status = 'failed';
                    break;
                default:
                    status = 'in_transit';
            }
        }

        // Parse estimated delivery
        if (shipment.estimatedDeliveryDate) {
            estimatedDelivery = shipment.estimatedDeliveryDate;
        }

        // Extract current location
        const currentLocation = latestEvent?.location ? {
            city: latestEvent.location.address?.addressLocality,
            state: latestEvent.location.address?.addressRegion,
            country: latestEvent.location.address?.countryCode
        } : null;

        return {
            carrier: 'DHL',
            trackingNumber: shipment.id,
            status,
            statusDetails,
            estimatedDelivery,
            actualDelivery,
            currentLocation,
            activities: events.map(event => ({
                timestamp: event.timestamp,
                location: event.location?.address,
                description: event.description,
                status: event.statusCode
            })),
            lastUpdated: new Date().toISOString()
        };
    }

    async batchTrack(trackingNumbers) {
        const results = [];
        
        // DHL API typically handles one tracking number per request
        // Process them sequentially to avoid rate limiting
        for (const trackingNumber of trackingNumbers) {
            try {
                const result = await this.trackPackage(trackingNumber);
                results.push(result);
                
                // Add small delay to respect rate limits
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                results.push({
                    trackingNumber,
                    error: error.message,
                    status: 'error'
                });
            }
        }
        
        return results;
    }
}

module.exports = DHLTracker;