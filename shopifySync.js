
// Initialize libraries
var nodeSchedule = require('node-schedule');
var Shopify = require('shopify-api-node');
var async = require('async');
var papaparse = require('paraparse');
var config = require('./config');

// Jobs ========================================================================

// All Jobs
var runAllJobs = function () {
	updateInventory();
	getOrders();
	updateShipments();
};

// Update Inventory: updates Shopify products using the API
var updateInventory = function () {
	console.log('Updating inventory...');



	// setupShopify();
	// shopify.product.list({ limit: 5 })
	// 	.then(function (products) {
	// 		console.log(products);
	// 	});
};

// Get Orders: creates CSV based on incoming orders
var getOrders = function () {
	console.log('Getting orders...');

};

// Update Shipments: updates Shopify orders using the API
var updateShipments = function () {
	console.log('Updating shipments...');

};

// Functions ===================================================================

var shopify = null;
var setupShopify = function () {
	if (!shopify) shopify = new Shopify({
		shopName: config.shopifyShopName,
		apiKey: config.shopifyAPIKey,
		password: config.shopifyPassword
	});
};

// Run Program =================================================================
console.log('shopify-sync started at '+Date());
runAllJobs();

// Start schedule
// var syncSchedule = nodeSchedule.scheduleJob(config.schedule, function () {
// 	console.log('Scheduled tasks started...')
// 	runAllJobs();
// });
