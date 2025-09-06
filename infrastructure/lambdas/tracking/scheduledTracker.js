const TrackingService = require('./trackingService');

const trackingService = new TrackingService();

/**
 * Scheduled Lambda function to update tracking for active shipments
 * Triggered by CloudWatch Events (e.g., every 4 hours)
 */
exports.handler = async (event) => {
    console.log('Starting scheduled tracking update...');
    
    const startTime = Date.now();
    let totalProcessed = 0;
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    try {
        // Get all active shipments that need tracking updates
        const activeShipments = await trackingService.getShipmentsByStatus('active', 1000);
        console.log(`Found ${activeShipments.length} active shipments to track`);

        if (activeShipments.length === 0) {
            console.log('No active shipments to track');
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'No active shipments to track',
                    processed: 0,
                    duration: Date.now() - startTime
                })
            };
        }

        // Filter shipments that haven't been tracked recently
        const now = new Date();
        const fourHoursAgo = new Date(now.getTime() - (4 * 60 * 60 * 1000));
        
        const shipmentsToTrack = activeShipments.filter(shipment => {
            // Track if never tracked before or last tracked more than 4 hours ago
            if (!shipment.lastTracked) return true;
            
            const lastTracked = new Date(shipment.lastTracked);
            return lastTracked < fourHoursAgo;
        });

        console.log(`${shipmentsToTrack.length} shipments need tracking updates`);

        if (shipmentsToTrack.length === 0) {
            console.log('All shipments have been tracked recently');
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'All shipments have been tracked recently',
                    totalShipments: activeShipments.length,
                    processed: 0,
                    duration: Date.now() - startTime
                })
            };
        }

        // Group shipments by carrier for efficient batch processing
        const carrierGroups = {};
        shipmentsToTrack.forEach(shipment => {
            const carrier = shipment.carrier;
            if (!carrierGroups[carrier]) {
                carrierGroups[carrier] = [];
            }
            carrierGroups[carrier].push(shipment.id);
        });

        console.log('Shipments by carrier:', Object.keys(carrierGroups).map(carrier => 
            `${carrier}: ${carrierGroups[carrier].length}`
        ).join(', '));

        // Process each carrier group
        for (const [carrier, shipmentIds] of Object.entries(carrierGroups)) {
            console.log(`Processing ${shipmentIds.length} ${carrier} shipments...`);
            
            try {
                // Process in smaller batches to avoid timeouts
                const batchSize = carrier === 'DHL' ? 10 : 25; // DHL has stricter rate limits
                
                for (let i = 0; i < shipmentIds.length; i += batchSize) {
                    const batch = shipmentIds.slice(i, i + batchSize);
                    console.log(`Processing batch ${Math.floor(i/batchSize) + 1} for ${carrier} (${batch.length} shipments)`);
                    
                    try {
                        const results = await trackingService.batchUpdateTracking(batch);
                        
                        results.forEach(result => {
                            totalProcessed++;
                            if (result.success) {
                                successCount++;
                                console.log(`✅ Updated ${result.shipmentId}: ${result.trackingData?.status || 'unknown'}`);
                            } else {
                                errorCount++;
                                errors.push({
                                    shipmentId: result.shipmentId,
                                    error: result.error,
                                    carrier: carrier
                                });
                                console.error(`❌ Failed ${result.shipmentId}: ${result.error}`);
                            }
                        });

                        // Add delay between batches to respect rate limits
                        if (i + batchSize < shipmentIds.length) {
                            const delay = carrier === 'DHL' ? 2000 : 1000;
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }

                    } catch (batchError) {
                        console.error(`Batch processing error for ${carrier}:`, batchError);
                        
                        // Mark all shipments in this batch as errored
                        batch.forEach(shipmentId => {
                            totalProcessed++;
                            errorCount++;
                            errors.push({
                                shipmentId,
                                error: batchError.message,
                                carrier: carrier
                            });
                        });
                    }
                }

            } catch (carrierError) {
                console.error(`Carrier processing error for ${carrier}:`, carrierError);
                
                // Mark all shipments for this carrier as errored
                shipmentIds.forEach(shipmentId => {
                    totalProcessed++;
                    errorCount++;
                    errors.push({
                        shipmentId,
                        error: carrierError.message,
                        carrier: carrier
                    });
                });
            }
        }

        const duration = Date.now() - startTime;
        
        console.log('Scheduled tracking update completed:');
        console.log(`- Total processed: ${totalProcessed}`);
        console.log(`- Successful: ${successCount}`);
        console.log(`- Errors: ${errorCount}`);
        console.log(`- Duration: ${duration}ms`);

        // Log errors for monitoring
        if (errors.length > 0) {
            console.error('Tracking errors summary:');
            const errorsByCarrier = errors.reduce((acc, error) => {
                acc[error.carrier] = (acc[error.carrier] || 0) + 1;
                return acc;
            }, {});
            console.error('Errors by carrier:', errorsByCarrier);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Scheduled tracking update completed',
                totalShipments: activeShipments.length,
                shipmentsNeedingUpdate: shipmentsToTrack.length,
                processed: totalProcessed,
                successful: successCount,
                errors: errorCount,
                duration: duration,
                errorDetails: errors.length > 10 ? errors.slice(0, 10) : errors // Limit error details in response
            })
        };

    } catch (error) {
        console.error('Scheduled tracking update failed:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Scheduled tracking update failed',
                message: error.message,
                processed: totalProcessed,
                successful: successCount,
                errors: errorCount,
                duration: Date.now() - startTime
            })
        };
    }
};

/**
 * Manual trigger function for testing
 */
exports.manualTrigger = async (shipmentIds = []) => {
    console.log('Manual tracking trigger started');
    
    try {
        if (shipmentIds.length === 0) {
            // Get all active shipments if none specified
            const activeShipments = await trackingService.getShipmentsByStatus('active', 100);
            shipmentIds = activeShipments.map(s => s.id);
        }

        if (shipmentIds.length === 0) {
            return { message: 'No shipments to track' };
        }

        console.log(`Manually tracking ${shipmentIds.length} shipments`);
        const results = await trackingService.batchUpdateTracking(shipmentIds);
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        console.log(`Manual tracking completed: ${successful} successful, ${failed} failed`);
        
        return {
            message: 'Manual tracking completed',
            processed: results.length,
            successful,
            failed,
            results
        };

    } catch (error) {
        console.error('Manual tracking failed:', error);
        throw error;
    }
};