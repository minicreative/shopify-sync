
// Initialize NPM libraries
var async = require('async');
var NodeSchedule = require('node-schedule');

// Initialize tools
var tools = './tools/'
var Files = require(tools+'files');

// Initialize config
var config = require('./config');

// Functions ===================================================================

// All Jobs
function runAllJobs () {
	console.log('Running all jobs at '+Date()+'...');
	async.waterfall([
	    updateInventory,
	    getOrders,
	    updateShipments,
	], function (err, result) {
	    if (err) console.log(err);
		console.log('Done!');
	});
};

// Update Inventory: updates Shopify products using the API
function updateInventory (next) {
	console.log('Updating inventory...');

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
				Files.handleInventory(file, function (err) {
					callback(err);
				});
			}, function (err) {
				callback(err, 'All files processed!');
			})
		},

	], function (err, result) {
		if (err) console.log(err);
		else console.log(result);
	});
};

// Get Orders: creates CSV based on incoming orders
function getOrders (next) {
	console.log('Getting orders...');
	return next();
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
