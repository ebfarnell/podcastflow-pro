const axios = require('axios');
const xml2js = require('xml2js');

class USPSTracker {
    constructor(config) {
        this.config = config;
        this.baseURL = config.sandbox ? 
            'https://secure.shippingapis.com/ShippingAPITest.dll' : 
            'https://secure.shippingapis.com/ShippingAPI.dll';
    }

    async trackPackage(trackingNumber) {
        try {
            const xml = `
                <TrackRequest USERID="${this.config.username}">
                    <TrackID ID="${trackingNumber}"></TrackID>
                </TrackRequest>
            `;

            const response = await axios.get(this.baseURL, {
                params: {
                    API: 'TrackV2',
                    XML: xml.trim()
                }
            });

            const parser = new xml2js.Parser({ explicitArray: false });
            const result = await parser.parseStringPromise(response.data);
            
            if (result.Error) {
                throw new Error(result.Error.Description || 'USPS API Error');
            }

            const trackInfo = result.TrackResponse?.TrackInfo;
            if (!trackInfo) {
                throw new Error('No tracking information found');
            }

            return this.parseUSPSResponse(trackInfo);
        } catch (error) {
            console.error('USPS tracking failed:', error.message);
            if (error.message.includes('not found') || error.message.includes('invalid')) {
                return {
                    status: 'not_found',
                    message: 'Tracking number not found',
                    trackingNumber
                };
            }
            throw error;
        }
    }

    parseUSPSResponse(trackInfo) {
        let status = 'unknown';
        let statusDetails = '';
        let estimatedDelivery = null;
        let actualDelivery = null;
        let currentLocation = null;
        const activities = [];

        // Parse main status
        if (trackInfo.Status) {
            statusDetails = trackInfo.Status;
            
            if (statusDetails.toLowerCase().includes('delivered')) {
                status = 'delivered';
                actualDelivery = trackInfo.StatusDate;
            } else if (statusDetails.toLowerCase().includes('in transit') || 
                      statusDetails.toLowerCase().includes('arrived') ||
                      statusDetails.toLowerCase().includes('departed')) {
                status = 'in_transit';
            } else if (statusDetails.toLowerCase().includes('acceptance') ||
                      statusDetails.toLowerCase().includes('picked up')) {
                status = 'shipped';
            } else if (statusDetails.toLowerCase().includes('exception') ||
                      statusDetails.toLowerCase().includes('undeliverable')) {
                status = 'failed';
            } else {
                status = 'in_transit';
            }
        }

        // Parse expected delivery
        if (trackInfo.PredictedDeliveryDate) {
            estimatedDelivery = trackInfo.PredictedDeliveryDate;
        } else if (trackInfo.ExpectedDeliveryDate) {
            estimatedDelivery = trackInfo.ExpectedDeliveryDate;
        }

        // Parse location
        if (trackInfo.StatusCity && trackInfo.StatusState) {
            currentLocation = {
                city: trackInfo.StatusCity,
                state: trackInfo.StatusState,
                country: 'US'
            };
        }

        // Add main activity
        if (trackInfo.Status && trackInfo.StatusDate) {
            activities.push({
                timestamp: trackInfo.StatusDate + 'T' + (trackInfo.StatusTime || '00:00:00'),
                location: currentLocation,
                description: trackInfo.Status,
                status: status
            });
        }

        // Parse track details if available
        if (trackInfo.TrackDetail) {
            const details = Array.isArray(trackInfo.TrackDetail) ? 
                trackInfo.TrackDetail : [trackInfo.TrackDetail];
            
            details.forEach(detail => {
                if (detail.EventDate && detail.Event) {
                    activities.push({
                        timestamp: detail.EventDate + 'T' + (detail.EventTime || '00:00:00'),
                        location: detail.EventCity && detail.EventState ? {
                            city: detail.EventCity,
                            state: detail.EventState,
                            country: detail.EventCountry || 'US'
                        } : null,
                        description: detail.Event,
                        status: detail.Event.toLowerCase().includes('delivered') ? 'delivered' : 'in_transit'
                    });
                }
            });
        }

        // Sort activities by timestamp (newest first)
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return {
            carrier: 'USPS',
            trackingNumber: trackInfo.$.ID,
            status,
            statusDetails,
            estimatedDelivery,
            actualDelivery,
            currentLocation,
            activities,
            lastUpdated: new Date().toISOString()
        };
    }

    async batchTrack(trackingNumbers) {
        const results = [];
        
        // USPS allows multiple tracking numbers in a single request
        const batchSize = 35; // Conservative limit
        
        for (let i = 0; i < trackingNumbers.length; i += batchSize) {
            const batch = trackingNumbers.slice(i, i + batchSize);
            
            try {
                const trackIds = batch.map(tn => `<TrackID ID="${tn}"></TrackID>`).join('');
                const xml = `
                    <TrackRequest USERID="${this.config.username}">
                        ${trackIds}
                    </TrackRequest>
                `;

                const response = await axios.get(this.baseURL, {
                    params: {
                        API: 'TrackV2',
                        XML: xml.trim()
                    }
                });

                const parser = new xml2js.Parser({ explicitArray: false });
                const result = await parser.parseStringPromise(response.data);
                
                if (result.TrackResponse?.TrackInfo) {
                    const trackInfos = Array.isArray(result.TrackResponse.TrackInfo) ? 
                        result.TrackResponse.TrackInfo : [result.TrackResponse.TrackInfo];
                    
                    trackInfos.forEach(trackInfo => {
                        try {
                            if (trackInfo.Error) {
                                results.push({
                                    trackingNumber: trackInfo.$.ID,
                                    error: trackInfo.Error,
                                    status: 'error'
                                });
                            } else {
                                const parsed = this.parseUSPSResponse(trackInfo);
                                results.push(parsed);
                            }
                        } catch (error) {
                            results.push({
                                trackingNumber: trackInfo.$.ID,
                                error: error.message,
                                status: 'error'
                            });
                        }
                    });
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

module.exports = USPSTracker;