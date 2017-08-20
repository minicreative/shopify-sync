
// Initialize NPM libraries
var async = require('async');
var NodeSchedule = require('node-schedule');
var moment = require('moment');

// Initialize tools
var tools = './tools/'
var Files = require(tools+'files');
var Shopify = require(tools+'shopify');

// Initialize config
var config = require('./config');

// Functions ===================================================================

// All Jobs
function runAllJobs () {
	console.log('Running all jobs at '+Date()+'...');
	async.waterfall([

		// Update inventory
		function (callback) {
			updateInventory(function (err) {
				callback(err);
			})
		},

		// Get orders
		function (callback) {
			getOrders(function (err) {
				callback(err);
			})
		},

		// Update Shipments
		function (callback) {
			updateShipments(function (err) {
				callback(err);
			});
		},

	], function (err) {
	    if (err) console.log(err);
		console.log('Done!');
	});
};

// Update Inventory: updates Shopify products using the API
function updateInventory (next) {

	async.waterfall([

		// Get files from directory
		function (callback) {
			Files.getParsedCSVs({
				'path': config.directories.inventory,
			}, function (err, files) {
				callback(err, files);
			});
		},

		// Get products map
		function (files, callback) {
			Shopify.makeProductsMap(function (err, map) {
				next(err, files, map);
			});
		},

		// Handle each file
		function (files, map, callback) {
			async.each(files, function (file, callback) {
				Shopify.handleInventoryFile({
					'file': file,
					'map': map,
				}, function (err) {
					callback(err);
				});
			}, function (err) {
				callback(err);
			})
		},

	], function (err) {
		next(err);
	});
};

// Get Orders: creates CSV based on incoming orders
function getOrders (next) {

	async.waterfall([

		// Get last order date
		function (callback) {
			Files.getTimestamp({
				'path': config.directories.timestamps+'orders.txt',
			}, function (err, timestamp) {
				callback(err, timestamp);
			})
		},

		// Get orders since timestamp
		function (timestamp, callback) {
			Shopify.getOrdersSinceTimestamp(timestamp, function (err, orders) {
				callback(err, orders);
			});
		},

		// Make orders file if orders are returned
		function (orders, callback) {
			if (orders.length) {
				Files.makeOrdersFile({
					'orders': orders,
					'path': config.directories.orders+'ShopifyOrders'+moment().format('YYYY-MM-DD-HH-mm-ss')+'.csv',
				}, function (err) {
					callback(err);
				})
			} else {
				callback();
			}
		},

		// Make timestamp file
		function (callback) {
			Files.makeTimestamp({
				'path': config.directories.timestamps+'orders.txt',
			}, function (err) {
				callback(err);
			});
		}

	], function (err) {
		next(err);
	})
};

// Update Shipments: updates Shopify orders using the API
function updateShipments (next) {
	console.log('Updating shipments...');
	return next();
};

// Run Program =================================================================
console.log('shopify-sync started at '+Date());
runAllJobs();

// Start schedule
// var syncSchedule = NodeSchedule.scheduleJob(config.schedule, function () {
// 	console.log('Scheduled tasks started...')
// 	runAllJobs();
// });
