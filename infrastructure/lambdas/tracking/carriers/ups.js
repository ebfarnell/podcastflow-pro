const axios = require('axios');

class UPSTracker {
    constructor(config) {
        this.config = config;
        this.baseURL = config.sandbox ? 
            'https://wwwcie.ups.com/api' : 
            'https://onlinetools.ups.com/api';
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    async authenticate() {
        try {
            const authString = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
            
            const response = await axios.post(`${this.baseURL}/security/v1/oauth/token`, 
                'grant_type=client_credentials',
                {
                    headers: {
                        'Authorization': `Basic ${authString}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
            return true;
        } catch (error) {
            console.error('UPS Authentication failed:', error.response?.data || error.message);
            throw new Error('UPS authentication failed');
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

            const response = await axios.get(
                `${this.baseURL}/track/v1/details/${trackingNumber}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    params: {
                        locale: 'en_US',
                        returnSignature: false
                    }
                }
            );

            const trackingData = response.data.trackResponse?.shipment?.[0];
            if (!trackingData) {
                throw new Error('No tracking data found');
            }

            return this.parseUPSResponse(trackingData);
        } catch (error) {
            console.error('UPS tracking failed:', error.response?.data || error.message);
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

    parseUPSResponse(shipment) {
        const activity = shipment.package?.[0]?.activity || [];
        const latestActivity = activity[0];
        
        let status = 'unknown';
        let statusDetails = '';
        
        if (latestActivity) {
            const statusCode = latestActivity.status?.code;
            const statusDesc = latestActivity.status?.description;
            
            switch (statusCode) {
                case 'D':
                    status = 'delivered';
                    break;
                case 'I':
                    status = 'in_transit';
                    break;
                case 'M':
                    status = 'shipped';
                    break;
                case 'X':
                    status = 'failed';
                    break;
                default:
                    status = 'in_transit';
            }
            
            statusDetails = statusDesc || '';
        }

        // Extract delivery info
        const deliveryInfo = shipment.deliveryInformation || {};
        const estimatedDelivery = deliveryInfo.estimatedDelivery?.date;
        const actualDelivery = status === 'delivered' ? latestActivity?.date : null;

        // Extract location info
        const currentLocation = latestActivity?.location ? {
            city: latestActivity.location.address?.city,
            state: latestActivity.location.address?.stateProvinceCode,
            country: latestActivity.location.address?.countryCode
        } : null;

        return {
            carrier: 'UPS',
            trackingNumber: shipment.inquiryNumber,
            status,
            statusDetails,
            estimatedDelivery,
            actualDelivery,
            currentLocation,
            activities: activity.map(act => ({
                timestamp: act.date + 'T' + act.time,
                location: act.location?.address,
                description: act.status?.description,
                status: act.status?.code
            })),
            lastUpdated: new Date().toISOString()
        };
    }

    async batchTrack(trackingNumbers) {
        const results = [];
        
        // UPS allows up to 25 tracking numbers per request
        const batchSize = 25;
        
        for (let i = 0; i < trackingNumbers.length; i += batchSize) {
            const batch = trackingNumbers.slice(i, i + batchSize);
            const batchPromises = batch.map(trackingNumber => 
                this.trackPackage(trackingNumber).catch(error => ({
                    trackingNumber,
                    error: error.message,
                    status: 'error'
                }))
            );
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }
        
        return results;
    }
}

module.exports = UPSTracker;