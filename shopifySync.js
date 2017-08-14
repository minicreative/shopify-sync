
// Initialize NPM libraries
var async = require('async');
var NodeSchedule = require('node-schedule');

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

		// Make products map
		function (callback) {
			makeProductsMap(function (err, map) {
				callback(err, map);
			})
		},

		// Update inventory
		function (map, callback) {
			updateInventory(map, function (err) {
				callback(err, map);
			})
		},

		// Get orders
		function (map, callback) {
			getOrders(map, function (err) {
				callback(err, map);
			})
		},

		// Update Shipments
		function (map, callback) {
			updateShipments(map, function (err) {
				callback(err, map);
			});
		}
	], function (err) {
	    if (err) console.log(err);
		console.log('Done!');
	});
};

// Make Products Maps: creates a UPC keyed hashmap of Shopify Proudct ID's
function makeProductsMap (next) {
	Files.makeProductsMap(function (err, map) {
		next(err, map);
	});
};

// Update Inventory: updates Shopify products using the API
function updateInventory (map, next) {

	// Initialize directory
	var directory = config.directories.inventory;

	// Waterfall
	async.waterfall([

		// Get files from directory
		function (callback) {
			Files.getFromDirectory(directory, function (err, files) {
				callback(err, files);
			});
		},

		// Handle each file
		function (files, callback) {
			async.each(files, function (file, callback) {
				Files.handleInventory({
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
function getOrders (map, next) {
	console.log('Getting orders...');
	return next();
};

// Update Shipments: updates Shopify orders using the API
function updateShipments (map, next) {
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
