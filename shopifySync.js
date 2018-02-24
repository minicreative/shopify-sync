// Initialize config
var config = require('./config');

// Initialize NPM libraries
var async = require('async');
var NodeSchedule = require('node-schedule');
var moment = require('moment');
var SendGrid = require('sendgrid')(config.sendgridAPIKey);
var Raven = require('raven');

// Setup Raven library
Raven.config(config.sentryAPIKey).install();

// Initialize tools
var tools = './tools/'
var Files = require(tools+'files');
var Shopify = require(tools+'shopify');
var Log = require(tools+'log');

// Functions ===================================================================

// All Jobs
function runAllJobs () {

	// Print time of jobs
	Log.log('Running all jobs at '+Date()+'...')

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

		// Capture orders
		function (callback) {
			captureShippedOrders(function (err) {
				callback(err);
			})
		},

	], function (err) {

		// Log error
	    if (err) {
			Log.log(err);
			Raven.captureException(err);
		}

		// Email logs
		emailLogs();
	});
};

// Email logs
function emailLogs () {

	// Don't send email if logEmail is null
	if (!config.logEmail) {
		Log.reset();
		return;
	}

	console.log('Emailing logs...');

	// Get messages
	var messages = Log.getLogs();

	// Format array into string
	var logString = "";
	for (var i in messages) logString += messages[i] + "<br />";

	// Setup email
	var request = SendGrid.emptyRequest({
		method: 'POST',
		path: '/v3/mail/send',
		body: {
			personalizations: [{
		        to: [{
					email: config.logEmail,
				}],
				subject: 'Shopify-Sync logs '+moment().format('MM/DD/YYYY h:mm:ss a')
			}],
		    from: {
				email: 'hello@minicreative.net'
			},
			content: [{
		        type: 'text/html',
		        value: logString
			}],
		},
	});

	// Send email
	SendGrid.API(request, function (error, response) {
		if (error) console.log('ERROR SENDING LOGS');
		else console.log('Logs emailed to '+config.logEmail);

		// Clear logs
		Log.reset();
	});

};

// Fix SKUs
function fixSKUs (next) {

	async.waterfall([

		// Make products maps
		function (callback) {
			Shopify.makeProductsMap(function (err, productsMap) {
				callback(err, productsMap);
			})
		},

		// Setup client
		function (productsMap, callback) {
			Shopify.setup(function (err, client) {
				callback(err, productsMap, client);
			});
		},

		// Fix all SKUs
		function (productsMap, client, callback) {
			async.eachOfSeries(productsMap, function (product, key, callback) {
				if (product.sku.charAt(0) !== '0') {
					var newSKU = '0'+product.sku;
					console.log(product.sku+" fixing to "+newSKU);
					Shopify.setVariant({
						client: client,
						update: {
							id: product.id,
							params: {
								sku: newSKU,
							},
						},
					}, function (err) {
						callback(err);
					});
				} else {
					console.log(product.sku + " no fix needed");
					callback();
				}
			}, function (err) {
				callback(err);
			})
		}

	], function (err) {
		if (!err) Log.log('SKU FIX COMPLETE');
		else Log.log('SKU FIX FAILED');
		next(err);
	})

}

// Update Inventory: updates Shopify products using the API
function updateInventory (next) {
	Log.log('');
	Log.log('TASK ONE: Inventory updates');

	async.waterfall([

		// Get files from directory
		function (callback) {
			Files.getParsedCSVs({
				'path': config.directories.inventory,
			}, function (err, files) {
				callback(err, files);
			});
		},

		// Make products maps
		function (files, callback) {
			if (files.length) {
				Shopify.makeProductsMap(function (err, productsMap) {
					callback(err, files, productsMap);
				})
			} else {
				callback(null, files, null);
			}
		},

		// Handle each file
		function (files, productsMap, callback) {
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
				Log.log('No inventory files found');
				callback(null);
			}
		},

	], function (err) {
		if (!err) Log.log('TASK ONE COMPLETE');
		else Log.log('TASK ONE FAILED');
		next(err);
	});
};

// Get Orders: creates CSV based on incoming orders
function getOrders (next) {
	Log.log('');
	Log.log('TASK TWO: Inventory updates');

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
			Log.log('Getting orders since '+timestamp);
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
					'path': config.directories.orders+'ShopifyOrders'+moment().format('YYYYMMDDHHmmss')+'.csv',
				}, function (err) {
					callback(err);
				})
			} else {
				Log.log('No orders since last update.');
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
		if (!err) Log.log('TASK TWO COMPLETE');
		else Log.log('TASK TWO FAILED');
		next(err);
	})
};

// Update Shipments: updates Shopify orders using the API
function updateShipments (next) {
	Log.log('');
	Log.log('TASK THREE: Shipment updates');

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
						'map': ordersMap,
					}, function (err) {
						callback(err);
					});
				}, function (err) {
					callback(err);
				})
			} else {
				Log.log('No shipment files found');
				callback(null);
			}
		},

	], function (err) {
		if (!err) Log.log('TASK THREE COMPLETE');
		else Log.log('TASK THREE FAILED');
		next(err);
	})
};

// Capture Completed Orders: page shipped orders and capture payment
function captureShippedOrders (next) {
	Log.log('');
	Log.log('TASK FOUR: Capture shipped orders');

	async.waterfall([

		// Get unpaid shipped orders
		function (callback) {
			Shopify.getOrders({
				'params': {
					'financial_status': 'unpaid',
					'fulfillment_status': 'shipped',
					'fields': "id,name"
				},
			}, function (err, orders) {
				callback(err, orders);
			});
		},

		// Capture orders
		function (orders, callback) {
			if (orders.length) {
				Shopify.captureOrders(orders, function (err) {
					callback(err);
				})
			} else {
				Log.log('No uncaptured orders found');
				callback(null);
			}
		},

	], function (err) {
		if (!err) Log.log('TASK FOUR COMPLETE');
		else Log.log('TASK FOUR FAILED');
		next(err);
	})
}

// Run Program =================================================================
console.log('shopify-sync started at '+Date());

// Always run at launch
runAllJobs();

// Schedule jobs
NodeSchedule.scheduleJob(config.schedule, function () {
	runAllJobs();
});
