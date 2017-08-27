
// Initialize NPM libraries
var async = require('async');
var Shopify = require('shopify-api-node');
var moment = require('moment');
var request = require('request');

// Initialize tools
var tools = './../tools/'
var FTP = require(tools+'ftp');
var Files = require(tools+'files');

// Initialize config
var config = require('./../config');

// Functions ===================================================================

// Throttle
function throttle (client, next) {
	if (client.callLimits.remaining < 11) {
		setTimeout(function () {
			next();
		}, 5000);
	} else next();
};

// Setup Shopify: makes a Shopify API client using config settings
function setupShopify (next) {
	console.log('Setting up Shopify client...');
	next(null, new Shopify({
		shopName: config.shopifyShopName,
		apiKey: config.shopifyAPIKey,
		password: config.shopifyPassword
	}));
};

// Manual Shopify Order Request: makes a Shopify API request manually
function manualShopifyOrderRequest({orderID, apiName, body}, next) {
	var options = {
		'method': "POST",
		'url': 'https://'+config.shopifyAPIKey+':'+config.shopifyPassword+'@'+config.shopifyShopName+'.myshopify.com/admin/orders/'+orderID+'/'+apiName+'.json',
		'body': body,
		'json': true,
	};
	request(options, function (err, response, body) {
		next(err, body);
	})
}

// Getters
function getProducts({params}, next) {
	console.log('Getting all products...');

	// Setup params
	if (!params) params = {};

	// Setup default params
	if (!params.limit) params.limit = 10;

	// Initialize output
	var output = new Array();

	// Waterfall
	async.waterfall([

		// Setup Shopify if neccesary
		function (callback) {
			setupShopify(function (err, client) {
				callback(err, client);
			});
		},

		// Get count of products
		function (client, callback) {

			// Setup count params
			var countParams = JSON.parse(JSON.stringify(params));
			delete countParams.limit;
			delete countParams.fields;

			// Get count
			client.product.count(countParams)
				.then(function (productCount) {
					callback(null, client, productCount);
				})
				.catch(function (err) {
					callback(err);
				})
		},

		// Make exhaustive product queries based on count
		function (client, productCount, callback) {

			// Initialize count
			var count = 0;

			// Exhaust products based on count
			async.whilst(function () {
				return count < productCount;
			}, function (callback) {

				// Setup list params
				params.page = Math.floor(count/params.limit)+1;

				// List objects
				throttle(client, function () {
					client.product.list(params)
					.then(function (products) {
						for (var i in products) {
							output.push(products[i]);
							count++;
						}
						console.log(count+'/'+productCount+' products downloaded...');
						callback();
					})
					.catch(function (err) {
						callback(err);
					})
				})
			}, function (err) {
				callback(err)
			})
		}
	], function (err) {
		next(err, output);
	})
}

function getOrders({params}, next) {
	console.log('Getting orders...');

	// Setup params
	if (!params) params = {};

	// Setup default params
	if (!params.limit) params.limit = 10;

	// Initialize output array
	var output = new Array();

	// Waterfall
	async.waterfall([

		// Setup Shopify if neccesary
		function (callback) {
			setupShopify(function (err, client) {
				callback(err, client);
			});
		},

		// Get count of orders
		function (client, callback) {

			// Setup count params
			var countParams = JSON.parse(JSON.stringify(params));
			delete countParams.limit;
			delete countParams.fields;

			// Get count
			client.order.count(countParams)
			.then(function (orderCount) {
				callback(null, client, orderCount);
			})
			.catch(function (err) {
				callback(err);
			})
		},

		// Make exhaustive order queries based on count
		function (client, orderCount, callback) {

			// Initialize count
			var count = 0;

			// Exhaust products based on count
			async.whilst(function () {
				return count < orderCount;
			}, function (callback) {

				// Setup list params
				params.page = Math.floor(count/params.limit)+1;

				// Make request
				throttle(client, function () {
					client.order.list(params)
					.then(function (orders) {
						for (var i in orders) {
							output.push(orders[i]);
							count++;
						}
						console.log(count+'/'+orderCount+' orders downloaded...');
						callback();
					})
					.catch(function (err) {
						callback(err);
					})
				})
			}, function (err) {
				callback(err)
			})
		}
	], function (err) {
		next(err, output);
	})
}

function setVariant({client, update}, next) {
	console.log('Updating Shopify variant...');
	throttle(client, function () {
		client.productVariant.update(update.id, update.params)
			.then(function (response) {
				next(null);
			})
			.catch(function (err) {
				next(err);
			})
	});
};

function getOrder ({client, id}, next) {
	console.log('Getting Shopify order...');
	throttle(client, function () {
		client.order.get(id, {
			'fields': 'id,line_items',
		})
		.then(function (order) {
			next(null, order);
		})
		.catch(function (err) {
			next(err);
		});
	})
};

function makeFulfillment({client, update}, next) {
	console.log('Making Shopify fulfillment...');
	manualShopifyOrderRequest({
		'apiName': 'fulfillments',
		'orderID': update.id,
		'body': update.params,
	}, function (err, response) {
		next(err, response);
	})
};

function makeTransaction({client, update}, next) {
	console.log('Making Shopify transaction...');
	manualShopifyOrderRequest({
		'apiName': 'transactions',
		'orderID': update.id,
		'body': update.params,
	}, function (err, response) {
		next(err, response);
	})
};

function captureOrders (orders, next) {
	console.log('Capturing orders...');

	async.waterfall([

		function (callback) {
			setupShopify(function (err, shopify) {
				callback(err, shopify);
			});
		},

		function (shopify, callback) {
			async.eachSeries(orders, function (order, callback) {
				makeTransaction({
					'client': shopify,
					'update': {
						'id': order.id,
						'params': {
							'transaction': {
								'kind': "capture"
							}
						},
					},
				}, function (err, response) {
					if (!err) console.log(order.name+' fulfilled successfully!');
					callback(err);
				});
			}, function (err) {
				callback(err);
			})
		},
	], function (err) {
		next(err);
	});

}

function handleInventoryFile ({file, map}, next) {
	console.log('Handling inventory file...');

	// Initialize rows
	var rows = file.data;

	async.waterfall([

		// Setup Shopify client
		function (callback) {
			setupShopify(function (err, shopify) {
				callback(err, shopify);
			});
		},

		// Make updates array
		function (shopify, callback) {

			// Initialize updates array
			var updates = new Array();

			// Loop through rows
			for (var i in rows) {

				// Initialize row
				var row = rows[i];

				// Initialize fields from row
				var upc = row['(C)upc'];
				var quantity = row['(E)quantity'];
				var regPrice = row['(F)RegPrice'];
				var salePrice = row['(G)SalePrice'];

				// Setup SKU & mapVariant
				var mapVariant = null;
				if (upc) {
					var sku = '0'+upc;
					mapVariant = map[sku];
				}

				// If variant is found in map & needs an update...
				if (mapVariant) {

					if (
						mapVariant.quantity != quantity ||
						mapVariant.price != salePrice ||
						mapVariant.compare_at_price != regPrice
					) {

						// Create update config
						var update = {
							'id': mapVariant.id,
							'upc': upc,
							'params': {
								'old_inventory_quantity': mapVariant.quantity,
								'inventory_quantity': quantity,
								'compare_at_price': regPrice,
								'price': salePrice,
							},
						};

						// Push into updates array
						updates.push(update);
					}

					else console.log('No update needed for '+upc);
				}

				// If varaint is not found in map...
				else {
					if (upc) console.log(upc+' not found in inventory');
				}
			}

			callback(null, shopify, updates);
		},

		// Make updates on Shopify synchronously
		function (shopify, updates, callback) {
			async.eachSeries(updates, function (update, callback) {
				setVariant({
					'client': shopify,
					'update': update,
				}, function (err) {
					if (!err) console.log(update.upc+' updated successfully!');
					callback(err);
				});
			}, function (err) {
				callback(err);
			});
		},

		// Setup FTP server
		function (callback) {
			FTP.setup(function (err, ftp) {
				callback(err, ftp);
			});
		},

		// Delete file from server
		function (ftp, callback) {
			FTP.delete({
				'client': ftp,
				'path': file.path
			}, function (err) {
				callback(err);
			});
		},

	], function (err) {
		next(err);
	})
};

function handleShipmentFile ({file, map}, next) {
	console.log('Handling shipment file...');

	// Initialize rows
	var rows = file.data;

	async.waterfall([

		// Setup Shopify client
		function (callback) {
			setupShopify(function (err, shopify) {
				callback(err, shopify);
			});
		},

		// Make updates array from shipments file
		function (shopify, callback) {

			// Initialize update arrays
			var fulfillmentUpdates = new Array();

			// Group rows into orders (only if PO # is provided - skips blank rows)
			var orders = {};
			for (var i in rows) {
				var orderName = rows[i]['PO #'];
				if (orderName) {
					if (!orders[orderName]) orders[orderName] = [];
					orders[orderName].push(rows[i]);
				}
			}

			// Iterate through orders
			for (var key in orders) {

				// Find key in ordersMap
				var mapOrder = map[key];

				// Handle order if found in map
				if (mapOrder) {

					// Initialize order array
					var order = orders[key];

					// Iterate through items in order
					for (var i in order) {

						// Initialize item & sku
						var item = order[i];
						var sku = '0'+item['SKU'];
						var tracking = item['Tracking #'];
						var company = item['Method'];
						var quantity = item['Quantity'];

						// Find matching line_item
						var line_item = null;
						for (var j in mapOrder.line_items) {
							if (mapOrder.line_items[j].sku == sku) {
								line_item = mapOrder.line_items[j]; break;
							}
						};

						// Make updates based on line item
						if (line_item) {

							// Make fulfillment update
							fulfillmentUpdates.push({
								'id': mapOrder.id,
								'orderName': key,
								'params': {
									'fulfillment': {
										'tracking_number': tracking,
										'tracking_company': company,
										'line_items': [
											{
												'id': line_item.id,
												'quantity': quantity
											}
										]
									}
								}
							});
						}

						// Handle SKU not found
						else {
							console.log(sku+' not found in order '+key);
						}
					}

				} else {
					console.log(key+' not found in orders');
				}
			}

			callback(null, shopify, fulfillmentUpdates);
		},

		// Make fulfillment updates on Shopify, collect responses for transaction updates
		function (shopify, fulfillmentUpdates, callback) {
			async.eachSeries(fulfillmentUpdates, function (update, callback) {
				makeFulfillment({
					'client': shopify,
					'update': update,
				}, function (err, response) {
					if (!err) console.log(update.orderName+' fulfilled successfully!');
					callback(err);
				});
			}, function (err) {
				callback(err);
			})
		},

		// Setup FTP server
		function (callback) {
			FTP.setup(function (err, ftp) {
				callback(err, ftp);
			});
		},

		// Delete file from server
		function (ftp, callback) {
			FTP.delete({
				'client': ftp,
				'path': file.path
			}, function (err) {
				callback(err);
			});
		},

	], function (err) {
		next(err);
	})
};

function makeProductsMap (next) {
	console.log('Making products map...');

	async.waterfall([

		// Get all products from Shopify
		function (callback) {
			getProducts({
				'params': {
					'fields': "id,variants",
				},
			}, function (err, products) {
				callback(err, products);
			})
		},

		// Create map of products
		function (products, callback) {
			var map = {};
			for (var i in products) {
				for (var j in products[i].variants) {
					map[products[i].variants[j].sku] = {
						'id': products[i].variants[j].id,
						'quantity': products[i].variants[j].inventory_quantity,
						'price': products[i].variants[j].price,
						'compare_at_price': products[i].variants[j].compare_at_price,
					};
				}
			}
			callback(null, map);
		},

	], function (err, map) {
		next(err, map);
	})
};

function makeOrdersMap (next) {
	console.log('Making orders map...');

	async.waterfall([

		// Get all products from Shopify
		function (callback) {
			getOrders({
				'params': {
					'fields': "id,name,line_items",
				},
			}, function (err, orders) {
				callback(err, orders);
			})
		},

		// Create map of orders
		function (orders, callback) {
			var map = {};
			for (var i in orders) {
				map[orders[i].name] = {
					'id': orders[i].id,
					'line_items': orders[i].line_items
				};
			}
			callback(null, map);
		},

	], function (err, map) {
		for (var key in map) {
			console.log("ORDER =================================");
			console.log(map[key]);
		}
		next(err, map);
	})
};

// Exports =====================================================================
module.exports = {
	setup: function (next) {
		setupShopify(next)
	},
	getProducts: function ({params}, next) {
		getProducts({params}, next)
	},
	getOrders: function ({params}, next) {
		getOrders({params}, next)
	},
	setVariant: function ({client, update}, next) {
		setVariant({client, update}, next)
	},
	handleInventoryFile: function ({file, map}, next) {
		handleInventoryFile({file, map}, next)
	},
	handleShipmentFile: function ({file, map}, next) {
		handleShipmentFile({file, map}, next)
	},
	captureOrders: function (orders, next) {
		captureOrders(orders, next)
	},
	makeProductsMap: function (next) {
		makeProductsMap(next)
	},
	makeOrdersMap: function (next) {
		makeOrdersMap(next)
	},
}
