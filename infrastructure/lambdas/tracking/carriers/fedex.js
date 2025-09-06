const axios = require('axios');

class FedExTracker {
    constructor(config) {
        this.config = config;
        this.baseURL = config.sandbox ? 
            'https://apis-sandbox.fedex.com' : 
            'https://apis.fedex.com';
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    async authenticate() {
        try {
            const authData = {
                grant_type: 'client_credentials',
                client_id: this.config.apiKey,
                client_secret: this.config.secretKey
            };

            const response = await axios.post(
                `${this.baseURL}/oauth/token`,
                authData,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
            return true;
        } catch (error) {
            console.error('FedEx Authentication failed:', error.response?.data || error.message);
            throw new Error('FedEx authentication failed');
        }
    }

    async ensureAuthenticated() {
        if (!this.accessToken || Date.now() >= this.tokenExpiry) {
            await this.authenticate();
        }
    }

    async trackPackage(trackingNumber) {
        try {
            await this.ensureAuthenticated();

            const trackingData = {
                includeDetailedScans: true,
                trackingInfo: [
                    {
                        trackingNumberInfo: {
                            trackingNumber: trackingNumber
                        }
                    }
                ]
            };

            const response = await axios.post(
                `${this.baseURL}/track/v1/trackingnumbers`,
                trackingData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json',
                        'X-locale': 'en_US'
                    }
                }
            );

            const trackingOutput = response.data.output?.completeTrackResults?.[0];
            if (!trackingOutput || trackingOutput.trackResults?.[0]?.error) {
                throw new Error('No tracking data found or tracking error');
            }

            return this.parseFedExResponse(trackingOutput.trackResults[0]);
        } catch (error) {
            console.error('FedEx tracking failed:', error.response?.data || error.message);
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

    parseFedExResponse(trackResult) {
        const scanEvents = trackResult.scanEvents || [];
        const latestEvent = scanEvents[0];
        
        let status = 'unknown';
        let statusDetails = '';
        
        if (latestEvent) {
            const eventType = latestEvent.eventType;
            const eventDescription = latestEvent.eventDescription;
            
            switch (eventType) {
                case 'DL':
                    status = 'delivered';
                    break;
                case 'IT':
                case 'AR':
                case 'DP':
                    status = 'in_transit';
                    break;
                case 'PU':
                case 'OC':
                    status = 'shipped';
                    break;
                case 'DE':
                case 'CA':
                    status = 'failed';
                    break;
                default:
                    status = 'in_transit';
            }
            
            statusDetails = eventDescription || '';
        }

        // Extract delivery dates
        const deliveryDetails = trackResult.deliveryDetails || {};
        const estimatedDelivery = deliveryDetails.estimatedDeliveryTimeWindow?.window?.ends;
        const actualDelivery = status === 'delivered' ? latestEvent?.date : null;

        // Extract location info
        const currentLocation = latestEvent?.scanLocation ? {
            city: latestEvent.scanLocation.city,
            state: latestEvent.scanLocation.stateOrProvinceCode,
            country: latestEvent.scanLocation.countryCode
        } : null;

        return {
            carrier: 'FedEx',
            trackingNumber: trackResult.trackingNumber,
            status,
            statusDetails,
            estimatedDelivery,
            actualDelivery,
            currentLocation,
            activities: scanEvents.map(event => ({
                timestamp: event.date + 'T' + (event.time || '00:00:00'),
                location: event.scanLocation,
                description: event.eventDescription,
                status: event.eventType
            })),
            lastUpdated: new Date().toISOString()
        };
    }

    async batchTrack(trackingNumbers) {
        const results = [];
        
        // FedEx allows up to 30 tracking numbers per request
        const batchSize = 30;
        
        for (let i = 0; i < trackingNumbers.length; i += batchSize) {
            const batch = trackingNumbers.slice(i, i + batchSize);
            
            try {
                await this.ensureAuthenticated();

                const trackingData = {
                    includeDetailedScans: true,
                    trackingInfo: batch.map(trackingNumber => ({
                        trackingNumberInfo: { trackingNumber }
                    }))
                };

                const response = await axios.post(
                    `${this.baseURL}/track/v1/trackingnumbers`,
                    trackingData,
                    {
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`,
                            'Content-Type': 'application/json',
                            'X-locale': 'en_US'
                        }
                    }
                );

                const trackingResults = response.data.output?.completeTrackResults || [];
                
                for (const result of trackingResults) {
                    if (result.trackResults?.[0]) {
                        try {
                            const parsed = this.parseFedExResponse(result.trackResults[0]);
                            results.push(parsed);
                        } catch (error) {
                            results.push({
                                trackingNumber: result.trackResults[0].trackingNumber,
                                error: error.message,
                                status: 'error'
                            });
                        }
                    }
                }
            } catch (error) {
                // If batch fails, add error for all tracking numbers in batch
                batch.forEach(trackingNumber => {
                    results.push({
                        trackingNumber,
                        error: error.message,
                        status: 'error'
                    });
                });
            }
        }
        
        return results;
    }
}

module.exports = FedExTracker;