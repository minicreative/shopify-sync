
// Initialize libraries
var nodeSchedule = require('node-schedule');
var config = require('./config');

// Initialize sync schedule ====================================================
console.log('shopify-sync started at '+Date());
console.log(config.production);
var syncSchedule = nodeSchedule.scheduleJob('10 * * * * *', function () {

	// Run jobs on schedule
	updateInventory();
	getOrders();
	updateShipments();

});

// Jobs ========================================================================

// Update Inventory: updates Shopify products using the API
var updateInventory = function () {

};

// Get Orders: creates CSV based on incoming orders
var getOrders = function () {

};

// Update Shipments: updates Shopify orders using the API
var updateShipments = function () {

};

// Functions ===================================================================
