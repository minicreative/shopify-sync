
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

		// Get products map
		function (callback) {
			getProductsMap(function (err, productsMap) {
				callback(err, productsMap);
			})
		},

		// Update inventory
		function (productsMap, callback) {
			updateInventory(productsMap, function (err) {
				callback(err, productsMap);
			})
		},

		// Update Shipments
		function (productsMap, callback) {
			updateShipments(productsMap, function (err) {
				callback(err);
			});
		},

		// Get orders
		function (callback) {
			getOrders(function (err) {
				callback(err);
			})
		},

	], function (err) {
	    if (err) console.log(err);
		console.log('Done!');
	});
};

function getProductsMap (next) {
	Shopify.makeProductsMap(function (err, productsMap) {
		next(err, productsMap);
	});
};

// Update Inventory: updates Shopify products using the API
function updateInventory (productsMap, next) {
	console.log('TASK ONE: Inventory updates');

	async.waterfall([

		// Get files from directory
		function (callback) {
			Files.getParsedCSVs({
				'path': config.directories.inventory,
			}, function (err, files) {
				callback(err, files);
			});
		},

		// Handle each file
		function (files, callback) {
			if (files.length) {
				async.each(files, function (file, callback) {
					Shopify.handleInventoryFile({
						'file': file,
						'map': productsMap,
					}, function (err) {
						callback(err);
					});
				}, function (err) {
					callback(err);
				});
			} else {
				callback(null);
			}
		},

	], function (err) {
		if (!err) console.log('TASK ONE COMPLETE');
		else console.log('TASK ONE FAILED');
		next(err, productsMap);
	});
};

// Update Shipments: updates Shopify orders using the API
function updateShipments (productsMap, next) {
	console.log('TASK TWO: Shipment updates');

	async.waterfall([

		// Get files from directory
		function (callback) {
			Files.getParsedCSVs({
				'path': config.directories.shipments,
			}, function (err, files) {
				callback(err, files);
			});
		},

		// Make orders map
		function (files, callback) {
			if (files.length) {
				Shopify.makeOrdersMap(function (err, ordersMap) {
					callback(err, files, ordersMap);
				});
			} else {
				callback(null, files, null);
			}
		},

		// Handle each file
		function (files, ordersMap, callback) {
			if (files.length) {
				async.each(files, function (file, callback) {
					Shopify.handleShipmentFile({
						'file': file,
						'ordersMap': ordersMap,
						'productsMap': productsMap,
					}, function (err) {
						callback(err);
					});
				}, function (err) {
					callback(err);
				})
			} else {
				callback(null);
			}
		},

	], function (err) {
		if (!err) console.log('TASK TWO COMPLETE');
		else console.log('TASK TWO FAILED');
		next(err);
	})
};

// Get Orders: creates CSV based on incoming orders
function getOrders (next) {
	console.log('TASK THREE: Inventory updates');

	async.waterfall([

		// Get last order date
		function (callback) {
			Files.getTimestamp({
				'path': config.directories.timestamps+'orders.txt',
			}, function (err, timestamp) {
				callback(err, timestamp);
			})
		},

		// Get detailed orders since timestamp
		function (timestamp, callback) {
			Shopify.getOrders({
				'params': {
					'created_at_min': timestamp,
					'fields': "id,name,email,phone,shipping_address,discount_codes,shipping_lines,total_tax,line_items",
				},
			}, function (err, orders) {
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
				callback(null);
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
		if (!err) console.log('TASK THREE COMPLETE');
		else console.log('TASK THREE FAILED');
		next(err);
	})
};

// Run Program =================================================================
console.log('shopify-sync started at '+Date());
runAllJobs();

// Start schedule
// var syncSchedule = NodeSchedule.scheduleJob(config.schedule, function () {
// 	console.log('Scheduled tasks started...')
// 	runAllJobs();
// });
